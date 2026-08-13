/** Account screen: full-data export and guarded account deletion (Phase 8).
 *  Deletion is armed by re-typing the account email, then confirmed via the
 *  cross-platform ActionSheet — the interim step-up until MFA lands. */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, spacing } from '@/components/theme';
import { Button, Card, ErrorNotice, Text, TextField, useActionSheet } from '@/components/ui';
import { deleteMyAccount } from '@/features/account/api';
import { exportFilename } from '@/features/account/export';
import { assembleExport } from '@/features/account/exportApi';
import { saveExport } from '@/features/account/saveExport';
import { useAuth } from '@/features/auth/AuthProvider';
import { toAppError } from '@/lib/errors';

export default function AccountScreen() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const sheet = useActionSheet();

  const [exporting, setExporting] = useState(false);
  const [exportErrorKey, setExportErrorKey] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteErrorKey, setDeleteErrorKey] = useState<string | null>(null);

  const email = user?.email ?? '';
  const armed = confirmEmail.trim().toLowerCase() === email.toLowerCase() && email.length > 0;

  async function onExport() {
    if (!user) return;
    setExportErrorKey(null);
    setExporting(true);
    try {
      const exportedAt = new Date().toISOString();
      const data = await assembleExport({ id: user.id, email: user.email ?? null }, exportedAt);
      await saveExport(JSON.stringify(data, null, 2), exportFilename(exportedAt));
    } catch (err) {
      setExportErrorKey(toAppError(err).messageKey ?? 'account.errors.exportFailed');
    } finally {
      setExporting(false);
    }
  }

  function onDeletePressed() {
    sheet.show({
      title: t('account.confirmTitle'),
      message: t('account.confirmBody'),
      cancelLabel: t('common.cancel'),
      actions: [
        {
          label: t('account.deleteCta'),
          destructive: true,
          onPress: () => {
            void (async () => {
              setDeleteErrorKey(null);
              setDeleting(true);
              try {
                await deleteMyAccount();
                await signOut(); // auth gate redirects to /login
              } catch (err) {
                setDeleteErrorKey(toAppError(err).messageKey);
                setDeleting(false);
              }
            })();
          },
        },
      ],
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Text variant="heading">{t('account.exportTitle')}</Text>
          <Text variant="caption" muted>
            {t('account.exportBody')}
          </Text>
          {exportErrorKey ? (
            <ErrorNotice
              message={t(exportErrorKey)}
              retryLabel={t('common.retry')}
              onRetry={() => void onExport()}
            />
          ) : null}
          <Button
            label={t('account.exportCta')}
            variant="secondary"
            onPress={onExport}
            loading={exporting}
          />
        </Card>

        <Card style={styles.dangerCard}>
          <Text variant="heading" style={styles.dangerTitle}>
            {t('account.deleteTitle')}
          </Text>
          <Text variant="caption" muted>
            {t('account.deleteWarning')}
          </Text>
          <TextField
            label={t('account.typeEmailLabel')}
            value={confirmEmail}
            onChangeText={setConfirmEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          {deleteErrorKey ? (
            <ErrorNotice message={t(deleteErrorKey)} retryLabel={t('common.retry')} />
          ) : null}
          <Button
            label={t('account.deleteCta')}
            onPress={onDeletePressed}
            disabled={!armed}
            loading={deleting}
            style={styles.dangerButton}
          />
        </Card>
      </ScrollView>
      {sheet.element}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, gap: spacing.md },
  dangerCard: { borderColor: '#E5C6C2' },
  dangerTitle: { color: palette.danger },
  dangerButton: { backgroundColor: palette.danger },
});
