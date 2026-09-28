# API .NET 10 — build context: apps/api (Railway: Root Directory = /apps/api)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY global.json Directory.Build.props ./
COPY src/Marketplace.Domain/Marketplace.Domain.csproj src/Marketplace.Domain/
COPY src/Marketplace.Application/Marketplace.Application.csproj src/Marketplace.Application/
COPY src/Marketplace.Infrastructure/Marketplace.Infrastructure.csproj src/Marketplace.Infrastructure/
COPY src/Marketplace.Api/Marketplace.Api.csproj src/Marketplace.Api/
RUN dotnet restore src/Marketplace.Api/Marketplace.Api.csproj
COPY src/ src/
RUN dotnet publish src/Marketplace.Api/Marketplace.Api.csproj -c Release -o /out --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
# .data guarda as chaves do DataProtection (CPF cifrado) e as imagens enviadas: monte um volume em /app/.data.
ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_FORWARDEDHEADERS_ENABLED=true \
    PORT=8080
COPY --from=build /out .
EXPOSE 8080
CMD ["sh", "-c", "ASPNETCORE_HTTP_PORTS=${PORT} exec dotnet Marketplace.Api.dll"]
