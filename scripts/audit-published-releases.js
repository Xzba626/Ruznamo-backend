const { PrismaClient } = require('@prisma/client');

/** Read-only audit: count PUBLISHED AppRelease rows (max must be 1). */
const p = new PrismaClient();

(async () => {
  const rows = await p.$queryRaw`
    SELECT
      id,
      "versionName",
      "versionCode",
      status::text AS status,
      "publishedAt",
      "archivedAt",
      sha256,
      "objectKey",
      "fileSize"::text AS "fileSize"
    FROM "AppRelease"
    ORDER BY "versionCode" DESC
  `;

  const published = rows.filter((r) => r.status === 'PUBLISHED');
  const byStatus = {};
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  }

  let artifactCols = [];
  try {
    artifactCols = await p.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'AppRelease'
        AND column_name IN ('artifactDeletedAt', 'artifactDeletedByAdminId')
    `;
  } catch {
    artifactCols = [];
  }

  const indexes = await p.$queryRaw`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'AppRelease'
      AND indexname = 'AppRelease_one_published_per_platform_idx'
  `;

  console.log(
    JSON.stringify(
      {
        publishedCount: published.length,
        publishedInvariantOk: published.length <= 1,
        dataIntegrity:
          published.length > 1
            ? 'DATA_INTEGRITY_FAIL'
            : published.length === 1
              ? 'OK'
              : 'NO_PUBLISHED',
        byStatus,
        schemaReady: {
          artifactDeletedColumns: artifactCols.map((c) => c.column_name),
          uniquePublishedIndexPresent: indexes.length > 0,
        },
        published: published.map((r) => ({
          id: r.id,
          versionName: r.versionName,
          versionCode: r.versionCode,
          publishedAt: r.publishedAt,
          sha256: r.sha256,
          objectKey: r.objectKey,
          fileSize: r.fileSize,
        })),
        all: rows.map((r) => ({
          versionName: r.versionName,
          versionCode: r.versionCode,
          status: r.status,
          publishedAt: r.publishedAt,
          archivedAt: r.archivedAt,
          sha256Prefix: r.sha256 ? String(r.sha256).slice(0, 16) : null,
          objectKey: r.objectKey,
        })),
      },
      null,
      2,
    ),
  );

  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
