namespace Marketplace.Application.Common;

public static class BusinessDays
{
    /// <summary>Soma dias úteis (segunda a sexta). Feriados não são considerados na estimativa.</summary>
    public static DateTime Add(DateTime start, int businessDays)
    {
        var date = start;
        var remaining = businessDays;
        while (remaining > 0)
        {
            date = date.AddDays(1);
            if (date.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday)) remaining--;
        }
        return date;
    }
}
