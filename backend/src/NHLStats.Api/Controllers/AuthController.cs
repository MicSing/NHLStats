using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using NHLStats.Domain;
using NHLStats.Domain.Identity;

namespace NHLStats.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<AppRole> _roleManager;
    private readonly IConfiguration _configuration;
    private readonly NhlStatsDbContext _db;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        RoleManager<AppRole> roleManager,
        IConfiguration configuration,
        NhlStatsDbContext db)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _configuration = configuration;
        _db = db;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var existing = await _userManager.FindByEmailAsync(dto.Email);
        if (existing != null) return Conflict(new { error = "Email already in use" });

        var user = new ApplicationUser { UserName = dto.Email, Email = dto.Email };
        var result = await _userManager.CreateAsync(user, dto.Password);
        if (!result.Succeeded)
        {
            return BadRequest(result.Errors.Select(e => e.Description));
        }

        await EnsureRoleExists(RoleNames.Participient);
        await _userManager.AddToRoleAsync(user, RoleNames.Participient);

        return StatusCode(201);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginDto dto)
    {
        var user = await _userManager.FindByEmailAsync(dto.Email);
        if (user == null) return Unauthorized();

        var passwordValid = await _userManager.CheckPasswordAsync(user, dto.Password);
        if (!passwordValid) return Unauthorized();

        var token = await GenerateJwtToken(user);
        return Ok(new { token });
    }

    [HttpPost("refresh")]
    [Authorize(AuthenticationSchemes = "RefreshBearer")]
    public async Task<IActionResult> Refresh()
    {
        var user = await GetCurrentUser();
        if (user == null) return Unauthorized();
        var token = await GenerateJwtToken(user);
        return Ok(new { token });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (sub == null) return Unauthorized();

        var user = await _userManager.FindByIdAsync(sub);
        if (user == null) return Unauthorized();

        var roles = await _userManager.GetRolesAsync(user);
        var isAdmin = roles.Contains(RoleNames.Admin);

        return Ok(new { id = user.Id, email = user.Email, userId = user.UserId, roles, isAdmin });
    }

    [Authorize(Roles = RoleNames.Admin)]
    [HttpGet("users")]
    public async Task<IActionResult> GetAllUsers()
    {
        var users = await _userManager.Users
            .OrderBy(u => u.Email)
            .ToListAsync();

        var payload = new List<object>();
        foreach (var user in users)
        {
            var roles = await _userManager.GetRolesAsync(user);
            payload.Add(new
            {
                user.Id,
                user.Email,
                user.UserId,
                roles,
                isAdmin = roles.Contains(RoleNames.Admin)
            });
        }

        return Ok(payload);
    }

    [Authorize(Roles = RoleNames.Admin)]
    [HttpPost("users")]
    public async Task<IActionResult> CreateUser(CreateLoginDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var existing = await _userManager.FindByEmailAsync(dto.Email);
        if (existing != null) return Conflict(new { error = "Email already in use" });

        if (dto.UserId.HasValue)
        {
            var appUser = await _db.Users.FindAsync(dto.UserId.Value);
            if (appUser == null) return BadRequest(new { error = "User not found" });
        }

        var user = new ApplicationUser
        {
            UserName = dto.Email,
            Email = dto.Email,
            UserId = dto.UserId
        };
        var result = await _userManager.CreateAsync(user, dto.Password);
        if (!result.Succeeded)
        {
            return BadRequest(result.Errors.Select(e => e.Description));
        }

        await EnsureRoleExists(RoleNames.Participient);
        await _userManager.AddToRoleAsync(user, RoleNames.Participient);

        var roles = await _userManager.GetRolesAsync(user);
        return StatusCode(201, new { id = user.Id, email = user.Email, userId = user.UserId, roles, isAdmin = roles.Contains(RoleNames.Admin) });
    }

    [Authorize(Roles = RoleNames.Admin)]
    [HttpPut("users/{id}/attach-user")]
    public async Task<IActionResult> AttachUser(string id, AttachUserDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var login = await _userManager.FindByIdAsync(id);
        if (login == null) return NotFound();

        var appUser = await _db.Users.FindAsync(dto.UserId);
        if (appUser == null) return BadRequest(new { error = "User not found" });

        login.UserId = dto.UserId;
        var updateResult = await _userManager.UpdateAsync(login);
        if (!updateResult.Succeeded)
        {
            return BadRequest(updateResult.Errors.Select(e => e.Description));
        }

        var roles = await _userManager.GetRolesAsync(login);
        return Ok(new { id = login.Id, email = login.Email, userId = login.UserId, roles, isAdmin = roles.Contains(RoleNames.Admin) });
    }

    [Authorize(Roles = RoleNames.Admin)]
    [HttpPut("users/{id}/roles")]
    public async Task<IActionResult> UpdateRoles(string id, UpdateLoginRolesDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var login = await _userManager.FindByIdAsync(id);
        if (login == null) return NotFound();

        await EnsureRoleExists(RoleNames.Participient);
        await EnsureRoleExists(RoleNames.Admin);

        var currentRoles = await _userManager.GetRolesAsync(login);
        var requestedRoles = dto.Roles
            .Where(r => !string.IsNullOrWhiteSpace(r))
            .Select(NormalizeRoleName)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (!requestedRoles.Contains(RoleNames.Participient, StringComparer.OrdinalIgnoreCase))
        {
            requestedRoles.Add(RoleNames.Participient);
        }

        var toRemove = currentRoles.Where(r => !requestedRoles.Contains(r, StringComparer.OrdinalIgnoreCase)).ToList();
        if (toRemove.Count > 0)
        {
            var removeResult = await _userManager.RemoveFromRolesAsync(login, toRemove);
            if (!removeResult.Succeeded)
            {
                return BadRequest(removeResult.Errors.Select(e => e.Description));
            }
        }

        var toAdd = requestedRoles.Where(r => !currentRoles.Contains(r, StringComparer.OrdinalIgnoreCase)).ToList();
        if (toAdd.Count > 0)
        {
            var addResult = await _userManager.AddToRolesAsync(login, toAdd);
            if (!addResult.Succeeded)
            {
                return BadRequest(addResult.Errors.Select(e => e.Description));
            }
        }

        var roles = await _userManager.GetRolesAsync(login);
        return Ok(new { id = login.Id, email = login.Email, userId = login.UserId, roles, isAdmin = roles.Contains(RoleNames.Admin) });
    }

    [Authorize(Roles = RoleNames.Admin)]
    [HttpDelete("users/{id}")]
    public async Task<IActionResult> DeleteUser(string id)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound();

        var result = await _userManager.DeleteAsync(user);
        if (!result.Succeeded) return BadRequest(result.Errors.Select(e => e.Description));

        return NoContent();
    }

    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var user = await GetCurrentUser();
        if (user == null) return Unauthorized();

        if (string.IsNullOrWhiteSpace(dto.CurrentPassword) || string.IsNullOrWhiteSpace(dto.NewPassword))
        {
            return BadRequest(new { error = "Current password and new password are required" });
        }

        if (dto.CurrentPassword == dto.NewPassword)
        {
            return BadRequest(new { error = "New password must be different from current password" });
        }

        var passwordValid = await _userManager.CheckPasswordAsync(user, dto.CurrentPassword);
        if (!passwordValid)
        {
            return BadRequest(new { error = "Current password is incorrect" });
        }

        var result = await _userManager.ChangePasswordAsync(user, dto.CurrentPassword, dto.NewPassword);
        if (!result.Succeeded)
        {
            return BadRequest(result.Errors.Select(e => e.Description));
        }

        return Ok(new { message = "Password changed successfully" });
    }

    [Authorize(Roles = RoleNames.Admin)]
    [HttpPost("users/{id}/change-password")]
    public async Task<IActionResult> ChangePasswordAsAdmin(string id, ChangePasswordAsAdminDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound();

        if (string.IsNullOrWhiteSpace(dto.NewPassword))
        {
            return BadRequest(new { error = "New password is required" });
        }

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        var result = await _userManager.ResetPasswordAsync(user, token, dto.NewPassword);
        if (!result.Succeeded)
        {
            return BadRequest(result.Errors.Select(e => e.Description));
        }

        return Ok(new { message = "Password changed successfully" });
    }

    private async Task<ApplicationUser?> GetCurrentUser()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (sub == null) return null;
        return await _userManager.FindByIdAsync(sub);
    }

    private async Task<string> GenerateJwtToken(ApplicationUser user)
    {
        var jwtSection = _configuration.GetSection("Jwt");
        var secret = jwtSection["Secret"] ?? "dev-secret-please-change";
        var issuer = jwtSection["Issuer"] ?? "NHLStats";
        var audience = jwtSection["Audience"] ?? "NHLStatsClient";
        var expiryMinutes = int.TryParse(jwtSection["ExpiryMinutes"], out var m) ? m : 60;

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var roles = await _userManager.GetRolesAsync(user);
        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id),
            new Claim(ClaimTypes.NameIdentifier, user.Id),
            new Claim(ClaimTypes.Email, user.Email ?? string.Empty)
        };

        foreach (var role in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        var token = new JwtSecurityToken(
            issuer,
            audience,
            claims,
            expires: DateTime.UtcNow.AddMinutes(expiryMinutes),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private async Task EnsureRoleExists(string roleName)
    {
        if (!await _roleManager.RoleExistsAsync(roleName))
        {
            await _roleManager.CreateAsync(new AppRole { Name = roleName });
        }
    }

    private static string NormalizeRoleName(string role)
    {
        if (role.Equals(RoleNames.Admin, StringComparison.OrdinalIgnoreCase)) return RoleNames.Admin;
        if (role.Equals(RoleNames.Participient, StringComparison.OrdinalIgnoreCase)) return RoleNames.Participient;
        return role;
    }

}

public class RegisterDto
{
    public string Email { get; set; } = null!;
    public string Password { get; set; } = null!;
}

public class LoginDto
{
    public string Email { get; set; } = null!;
    public string Password { get; set; } = null!;
}

public class CreateLoginDto
{
    public string Email { get; set; } = null!;
    public string Password { get; set; } = null!;
    public int? UserId { get; set; }
}

public class AttachUserDto
{
    public int UserId { get; set; }
}

public class UpdateLoginRolesDto
{
    public List<string> Roles { get; set; } = [];
}

public class ChangePasswordDto
{
    public string CurrentPassword { get; set; } = null!;
    public string NewPassword { get; set; } = null!;
}

public class ChangePasswordAsAdminDto
{
    public string NewPassword { get; set; } = null!;
}
