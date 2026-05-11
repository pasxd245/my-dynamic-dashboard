import { LoadingMask } from "../feedback";

interface UploadLoadingMaskProps {
  readonly visible: boolean;
  readonly message: string;
}

export default function UploadLoadingMask({ visible, message }: UploadLoadingMaskProps): React.ReactElement | null {
  return (
    <LoadingMask
      visible={visible}
      title="Working on your upload..."
      message={message}
      scope="container"
      zIndex={20}
    />
  );
}
