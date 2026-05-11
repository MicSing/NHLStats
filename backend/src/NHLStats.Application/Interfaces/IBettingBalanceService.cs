using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface IBettingBalanceService
{
    Task<BettingBalanceDto> GetBalanceAsync(string loginId);
}
