FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /app

# Copy csproj files and restore
COPY src/NHLStats.Domain/NHLStats.Domain.csproj src/NHLStats.Domain/
COPY src/NHLStats.Application/NHLStats.Application.csproj src/NHLStats.Application/
COPY src/NHLStats.Api/NHLStats.Api.csproj src/NHLStats.Api/

RUN dotnet restore src/NHLStats.Api/NHLStats.Api.csproj

# Copy all sources and build
COPY src/ src/
RUN dotnet publish src/NHLStats.Api/NHLStats.Api.csproj -c Release -o /out

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /out .

ENV ASPNETCORE_URLS=http://+:5267
EXPOSE 5267

ENTRYPOINT ["dotnet", "NHLStats.Api.dll"]
