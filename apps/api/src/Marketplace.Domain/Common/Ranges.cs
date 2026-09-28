namespace Marketplace.Domain.Common;

public readonly record struct DayRange(int Min, int Max);

public readonly record struct DateRange(DateTime Min, DateTime Max);
