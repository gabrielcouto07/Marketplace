using System.Net;
using System.Net.Mail;
using Marketplace.Application.Abstractions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Email;

public sealed class EmailOptions
{
    /// <summary>"Log" (dev) ou "Smtp".</summary>
    public string Provider { get; set; } = "Log";
    public string FromAddress { get; set; } = "no-reply@marketplacepy.com";
    public string FromName { get; set; } = "Marketplace PY";
    public string SmtpHost { get; set; } = string.Empty;
    public int SmtpPort { get; set; } = 587;
    public string? SmtpUser { get; set; }
    public string? SmtpPassword { get; set; }
    public bool SmtpUseSsl { get; set; } = true;
}

public sealed class LoggingEmailSender(ILogger<LoggingEmailSender> logger) : IEmailSender
{
    public Task SendAsync(EmailMessage message, CancellationToken ct)
    {
        logger.LogInformation("E-mail (dev) para {To}: {Subject}\n{Body}", message.To, message.Subject, message.TextBody);
        return Task.CompletedTask;
    }
}

public sealed class SmtpEmailSender(IOptions<EmailOptions> options) : IEmailSender
{
    public async Task SendAsync(EmailMessage message, CancellationToken ct)
    {
        var o = options.Value;
        using var client = new SmtpClient(o.SmtpHost, o.SmtpPort)
        {
            EnableSsl = o.SmtpUseSsl,
            Credentials = string.IsNullOrEmpty(o.SmtpUser) ? null : new NetworkCredential(o.SmtpUser, o.SmtpPassword),
        };
        using var mail = new MailMessage(new MailAddress(o.FromAddress, o.FromName), new MailAddress(message.To))
        {
            Subject = message.Subject,
            Body = message.HtmlBody ?? message.TextBody,
            IsBodyHtml = message.HtmlBody is not null,
        };
        await client.SendMailAsync(mail, ct);
    }
}
