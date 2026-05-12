using Microsoft.AspNetCore.Identity;
using NHLStats.Domain.Entities;

namespace NHLStats.Domain.Identity;

public class ApplicationUser : IdentityUser
{
    public int? UserId { get; set; }
    public User? User { get; set; }
    public string? Alias { get; set; }
}
