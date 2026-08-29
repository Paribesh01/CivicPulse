-- better-auth 1.7 scopes account identity by issuer and looks credentials up
-- by (issuer, accountId). Every account row that exists at this point was
-- created as an email/password credential, so they all backfill to the
-- credential issuer; the default is then dropped so future rows must state
-- their own issuer.
ALTER TABLE "account" ADD COLUMN "issuer" TEXT NOT NULL DEFAULT 'local:credential';
ALTER TABLE "account" ALTER COLUMN "issuer" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "account_issuer_accountId_key" ON "account"("issuer", "accountId");
