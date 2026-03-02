using System.ComponentModel.DataAnnotations;

namespace NHLStats.Application.DTOs;

public record UserDto(int Id, string Name, bool IsActive);

public record CreateUserDto([Required] string Name);

public record UpdateUserDto([Required] string Name, bool IsActive);
