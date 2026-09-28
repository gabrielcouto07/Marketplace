using System.Globalization;
using System.Text;

namespace Marketplace.Domain.Common;

/// <summary>
/// Port exato das funções <c>seeded</c> (mulberry32), <c>hashString</c> (FNV-1a) e <c>guid</c> do mock do
/// frontend (apps/web/src/mocks/fixtures/base.ts). Garante que os IDs do seed sejam os mesmos que o
/// front já conhece (carrinho e favoritos persistidos no dispositivo continuam válidos).
/// </summary>
public static class DeterministicId
{
    public static uint HashString(string s)
    {
        uint h = 2166136261;
        foreach (var ch in s)
        {
            h ^= ch;
            h = unchecked(h * 16777619);
        }
        return h;
    }

    public static Func<double> Seeded(uint seed)
    {
        var a = seed;
        return () =>
        {
            a = unchecked(a + 0x6d2b79f5);
            var t = a;
            t = unchecked((t ^ (t >> 15)) * (t | 1));
            t ^= unchecked(t + ((t ^ (t >> 7)) * (t | 61)));
            return (t ^ (t >> 14)) / 4294967296.0;
        };
    }

    public static Guid Guid(string key)
    {
        var rnd = Seeded(HashString(key));
        var sb = new StringBuilder(36);
        void Seg(int n)
        {
            for (var i = 0; i < n; i++)
                sb.Append(((int)Math.Floor(rnd() * 16)).ToString("x", CultureInfo.InvariantCulture));
        }
        Seg(8);
        sb.Append('-');
        Seg(4);
        sb.Append("-4");
        Seg(3);
        sb.Append("-a");
        Seg(3);
        sb.Append('-');
        Seg(12);
        return System.Guid.Parse(sb.ToString());
    }
}
