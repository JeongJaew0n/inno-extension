import { writePlainText } from '../../../../platform/clipboard/writePlainText';

export async function writeCommitSha(sha: string): Promise<void> {
  await writePlainText(sha);
}
