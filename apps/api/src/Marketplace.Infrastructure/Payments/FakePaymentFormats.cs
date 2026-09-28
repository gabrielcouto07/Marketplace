using System.Globalization;
using Marketplace.Domain.Common;

namespace Marketplace.Infrastructure.Payments;

/// <summary>Payloads de demonstração (mesmo formato do mock do front) usados pelo gateway fake e pelo seed.</summary>
public static class FakePaymentFormats
{
    public static string PixPayload(Guid purchaseId, Money amount)
    {
        var digits = amount.Amount.ToString(CultureInfo.InvariantCulture).PadLeft(10, '0');
        return $"00020126580014br.gov.bcb.pix0136{purchaseId}52040000530398654{digits.Length:00}{digits}5802BR5915MKTPY PAGAMENTOS6009SAO PAULO62070503***6304ABCD";
    }

    public static (string Barcode, string DigitableLine) Boleto(Money amount)
    {
        var digits = amount.Amount.ToString(CultureInfo.InvariantCulture).PadLeft(10, '0');
        var barcode = $"23790{digits}00000000000000000000000000000000"[..44];
        var line = $"23790.{digits[..5]} {digits[5..10]}.000000 00000.000000 1 {digits}";
        return (barcode, line);
    }
}
