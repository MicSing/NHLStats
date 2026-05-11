using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;

namespace NHLStats.Application.Services;

public class BettingBalanceService : IBettingBalanceService
{
    private readonly IBettingCalculator _calculator;

    public BettingBalanceService(IBettingCalculator calculator) => _calculator = calculator;

    public async Task<BettingBalanceDto> GetBalanceAsync(string loginId)
    {
        var data = await _calculator.LoadForLoginAsync(loginId);
        if (data == null) return new BettingBalanceDto(0, 0, 0, 0, 0, 0);
        var b = _calculator.Compute(data);
        return new BettingBalanceDto(b.AvailableBalance, b.MaxWinCap, b.TotalPositiveCash, b.TotalWonProfit, b.TotalPendingStake, b.TotalLostStake);
    }
}
