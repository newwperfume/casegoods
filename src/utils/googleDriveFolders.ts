export interface DriveFolderItem {
  id: string;
  name: string;
  webViewLink: string;
  modifiedTime?: string;
}

/**
 * Queries the user's Google Drive for non-trashed folders using only read-only metadata access.
 */
export async function listGoogleDriveFolders(
  accessToken: string,
  searchQuery = ''
): Promise<DriveFolderItem[]> {
  const escaped = searchQuery.trim().replace(/'/g, "\\'");
  const qParts = [
    "mimeType = 'application/vnd.google-apps.folder'",
    'trashed = false',
  ];
  if (escaped) {
    qParts.push(`name contains '${escaped}'`);
  }

  const params = new URLSearchParams({
    q: qParts.join(' and '),
    fields: 'files(id,name,webViewLink,modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: '25',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    if (res.status === 401) {
      throw new Error('DRIVE_TOKEN_EXPIRED');
    }
    throw new Error(`Google Drive request failed (${res.status}): ${errText}`);
  }

  const json = (await res.json()) as {
    files?: Array<{
      id?: string;
      name?: string;
      webViewLink?: string;
      modifiedTime?: string;
    }>;
  };

  return (json.files || [])
    .filter((f): f is { id: string; name: string; webViewLink?: string; modifiedTime?: string } =>
      Boolean(f.id && f.name)
    )
    .map((f) => ({
      id: f.id,
      name: f.name,
      webViewLink: f.webViewLink || `https://drive.google.com/drive/folders/${f.id}`,
      modifiedTime: f.modifiedTime,
    }));
}
