# turtlicious

Standalone React web app and deployment repository for <http://turtlicio.us>.

## Structure

- `src/` — React application source, styles, and tests.
- `public/` — static assets copied by Vite.
- `ops/` — future operational scripts and runbooks.
- `.github/workflows/` — CI and AWS S3 deploy automation.
- `Makefile` — common development and verification commands.

## Commands

- `make install` — install dependencies from `package-lock.json`.
- `make run` — run the Vite dev server on <http://localhost:5173>.
- `make test` — run unit tests.
- `make build` — type-check and build production assets.
- `make check` — run lint, type-check, tests, and build.
- `make deploy AWS_S3_BUCKET=...` — build and sync `dist/` to a preconfigured S3 website bucket.

Node.js 22+ is expected for local development.

## AWS deployment

This repo assumes the AWS infrastructure already exists. Deployment is just a Vite production build plus `aws s3 sync` into a preconfigured S3 static website bucket.

### One-time prerequisites

Install these locally:

- Node.js 22+
- AWS CLI v2

Preconfigure an S3 bucket for static website hosting in AWS, then point Route53 for `turtlicio.us` at that bucket website endpoint or whatever front door you choose.

Never commit AWS credentials.

### Required S3 bucket setup

The deployment expects a bucket that is already configured outside this repo:

- Static website hosting enabled.
- `index.html` configured as the index document.
- `index.html` configured as the error document if you want React client-side routes to work on refresh.
- A bucket policy or other access setup that allows the website to be read by users.
- An IAM user or role with permission to run `s3:ListBucket`, `s3:PutObject`, and `s3:DeleteObject` for that bucket.

### Create the GitHub deploy access key

1. Open the AWS Console and go to IAM → Users → Create user.
2. Use a name like `turtlicious-github-deploy`.
3. Do not enable AWS Management Console access.
4. Attach a least-privilege policy that can sync to your preconfigured S3 bucket.
5. Open the user → Security credentials → Access keys → Create access key.
6. Choose “Application running outside AWS” when AWS asks for the use case.
7. Copy the Access key ID and Secret access key immediately; AWS will not show the secret again.

Example deploy policy shape, replacing `YOUR_BUCKET_NAME` with your bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:DeleteObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    }
  ]
}
```

### Add GitHub Actions secrets and variables

In GitHub, open the repository → Settings → Secrets and variables → Actions.

Add repository secrets:

- `AWS_ACCESS_KEY_ID` — the deploy user's access key ID.
- `AWS_SECRET_ACCESS_KEY` — the deploy user's secret access key.

Add repository variables:

- `AWS_REGION` — `us-east-1`.
- `AWS_S3_BUCKET` — the name of your preconfigured S3 website bucket.

After these are set:

- [CI](.github/workflows/ci.yml) runs app linting, type-checking, tests, and build.
- [Deploy](.github/workflows/deploy.yml) runs on pushes to `main` or manually, builds the app, and syncs `dist/` to S3.

### Optional local deploy

With local AWS credentials configured, deploy manually with:

`make deploy AWS_S3_BUCKET=<bucket_name>`
