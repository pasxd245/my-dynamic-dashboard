import { ToastStack } from "../feedback";
import type { AppToast, AppToastTone } from "../feedback";

export type UploadToastTone = AppToastTone;

export interface UploadToast extends AppToast {}

interface UploadToastStackProps {
  readonly toasts: UploadToast[];
}

export default function UploadToastStack({ toasts }: UploadToastStackProps): React.ReactElement | null {
  return <ToastStack toasts={toasts} top="1rem" right="1rem" zIndex={30} />;
}
