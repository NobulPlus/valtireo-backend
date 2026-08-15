import { Check, Save, Send, X, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ModalActionProps {
  onClick?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  title?: string;
  form?: string;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: LucideIcon;
}

export function ModalCancelAction({ onClick, disabled, title = 'Cancel' }: ModalActionProps) {
  return (
    <Button type="button" size="icon" onClick={onClick} disabled={disabled} title={title} aria-label={title}>
      <X className="h-3.5 w-3.5" />
    </Button>
  );
}

export function ModalSaveAction({
  form,
  onClick,
  disabled,
  isLoading,
  title = 'Save changes',
  type = form ? 'submit' : 'button',
}: ModalActionProps) {
  return (
    <Button
      type={type}
      form={form}
      size="icon"
      variant="primary"
      onClick={onClick}
      disabled={disabled}
      isLoading={isLoading}
      title={title}
      aria-label={title}
    >
      <Save className="h-3.5 w-3.5" />
    </Button>
  );
}

export function ModalConfirmAction({
  onClick,
  disabled,
  isLoading,
  title = 'Confirm',
  variant = 'primary',
  icon: Icon = Check,
}: ModalActionProps) {
  return (
    <Button
      type="button"
      size="icon"
      variant={variant}
      onClick={onClick}
      disabled={disabled}
      isLoading={isLoading}
      title={title}
      aria-label={title}
    >
      <Icon className="h-3.5 w-3.5" />
    </Button>
  );
}

export function ModalSendAction(props: Omit<ModalActionProps, 'icon' | 'variant'>) {
  return <ModalConfirmAction {...props} title={props.title ?? 'Submit'} icon={Send} />;
}
