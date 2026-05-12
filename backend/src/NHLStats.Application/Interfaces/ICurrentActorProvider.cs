namespace NHLStats.Application.Interfaces;

public interface ICurrentActorProvider
{
    string? ActorUserId { get; }
    string? ActorUserName { get; }
}
