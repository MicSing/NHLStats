namespace NHLStats.Application.DTOs;

public record ExpenseDto(int Id, string? Description, decimal Amount, DateTime Date);

public record CreateExpenseDto(string? Description, decimal Amount, DateTime Date);

public record UpdateExpenseDto(string? Description, decimal Amount, DateTime Date);
