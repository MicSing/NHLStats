using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class ExpenseService : IExpenseService
{
    private readonly NhlStatsDbContext _db;

    public ExpenseService(NhlStatsDbContext db) => _db = db;

    private static ExpenseDto ToDto(Expense e) => new(e.Id, e.Description, e.Amount, e.Date);

    public async Task<IEnumerable<ExpenseDto>> GetAllAsync() =>
        await _db.Expenses
            .OrderByDescending(e => e.Date)
            .Select(e => ToDto(e))
            .ToListAsync();

    public async Task<ExpenseDto?> GetByIdAsync(int id)
    {
        var e = await _db.Expenses.FindAsync(id);
        return e == null ? null : ToDto(e);
    }

    public async Task<ExpenseDto> CreateAsync(CreateExpenseDto dto)
    {
        var expense = new Expense
        {
            Description = dto.Description,
            Amount = dto.Amount,
            Date = dto.Date
        };
        _db.Expenses.Add(expense);
        await _db.SaveChangesAsync();
        return ToDto(expense);
    }

    public async Task<ExpenseDto?> UpdateAsync(int id, UpdateExpenseDto dto)
    {
        var expense = await _db.Expenses.FindAsync(id);
        if (expense == null) return null;

        expense.Description = dto.Description;
        expense.Amount = dto.Amount;
        expense.Date = dto.Date;
        await _db.SaveChangesAsync();
        return ToDto(expense);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var expense = await _db.Expenses.FindAsync(id);
        if (expense == null) return false;

        _db.Expenses.Remove(expense);
        await _db.SaveChangesAsync();
        return true;
    }
}
