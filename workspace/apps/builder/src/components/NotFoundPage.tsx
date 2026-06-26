// R101 — global catch-all 404. Unknown routes (e.g. a bare /dashboard, a stale
// link) land here instead of rendering blank. Detail surfaces keep their own
// resource-specific not-found states; this is the app-wide fallback.

import { PageContainer } from '@mdd/ui';
import { Button, Result } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export function NotFoundPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <PageContainer width="text" dataComponent="NotFoundPage">
      <Result
        status="404"
        title={t('notFound.title')}
        subTitle={t('notFound.subtitle')}
        extra={
          <Button type="primary" onClick={() => navigate('/')}>
            {t('notFound.back')}
          </Button>
        }
      />
    </PageContainer>
  );
}
