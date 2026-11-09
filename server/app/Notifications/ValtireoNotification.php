<?php

namespace App\Notifications;

use App\Notifications\Channels\ExpoPushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Runs through the queue (QUEUE_CONNECTION, worker already running via
 * `composer dev`'s queue:listen) rather than inline on the request that
 * triggered it. Fanning out to every recipient of e.g. an org-wide
 * calendar event means one HTTP push call per recipient with a device
 * token (ExpoPushChannel, up to a 10s timeout each) — synchronously,
 * that held the triggering request open until every recipient was
 * processed. Tests run with QUEUE_CONNECTION=sync, so this executes
 * inline there and existing assertions are unaffected.
 */
class ValtireoNotification extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * @param array<string, mixed> $data
     */
    public function __construct(private readonly array $data)
    {
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        $channels = ['database', ExpoPushChannel::class];

        if (config('services.valtireo_notifications.mail_enabled')) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return $this->data;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $message = (new MailMessage)->subject($this->data['title'] ?? 'OrgaviaHR notification');

        return match ($this->data['event'] ?? null) {
            'organization.admin_invited' => $this->organizationAdminInvitedMail($message, $notifiable),
            'employee.invited' => $this->employeeInvitedMail($message, $notifiable),
            default => $this->genericMail($message, $notifiable),
        };
    }

    private function organizationAdminInvitedMail(MailMessage $message, object $notifiable): MailMessage
    {
        $organizationCode = $this->data['metadata']['organization_code'] ?? null;

        $message
            ->greeting("Welcome, {$notifiable->name}!")
            ->line($this->data['message'] ?? 'You have been invited to OrgaviaHR.')
            ->line('Use the setup link below to choose your password and activate your organization workspace.')
            ->line("Email: **{$notifiable->email}**");

        if (! empty($this->data['action_url']) && ! empty($this->data['action_label'])) {
            $message->action($this->data['action_label'], $this->absoluteUrl($this->data['action_url']));
        }

        $message->line("Once you sign in, you'll be guided through completing your organization's workspace setup — branding, locations, departments, and your team.");

        if ($organizationCode) {
            $message->line("Your organization code is **{$organizationCode}**.");
        }

        return $message->salutation("Welcome aboard,\nThe OrgaviaHR Team");
    }

    private function employeeInvitedMail(MailMessage $message, object $notifiable): MailMessage
    {
        $expiresAt = $this->data['metadata']['expires_at'] ?? null;

        $message
            ->greeting("Hi {$notifiable->name},")
            ->line($this->data['message'] ?? 'You have been invited to join OrgaviaHR.')
            ->line('This is a one-time invitation link — use it to set your password and get started.');

        if (! empty($this->data['action_url']) && ! empty($this->data['action_label'])) {
            $message->action($this->data['action_label'], $this->absoluteUrl($this->data['action_url']));
        }

        if ($expiresAt) {
            $formatted = \Illuminate\Support\Carbon::parse($expiresAt)->format('F j, Y \a\t g:i A');
            $message->line("This link expires on **{$formatted}**. If it expires, ask your HR team to resend the invitation.");
        }

        return $message->salutation("See you soon,\nThe OrgaviaHR Team");
    }

    private function genericMail(MailMessage $message, object $notifiable): MailMessage
    {
        $message
            ->greeting("Hello {$notifiable->name},")
            ->line($this->data['message'] ?? 'You have a new OrgaviaHR notification.');

        if (! empty($this->data['action_url']) && ! empty($this->data['action_label'])) {
            $message->action($this->data['action_label'], $this->absoluteUrl($this->data['action_url']));
        }

        return $message->line('Thank you for using OrgaviaHR.');
    }

    private function absoluteUrl(string $url): string
    {
        if (str_starts_with($url, 'http://') || str_starts_with($url, 'https://')) {
            return $url;
        }

        return rtrim(config('services.valtireo_notifications.frontend_url'), '/').'/'.ltrim($url, '/');
    }
}
