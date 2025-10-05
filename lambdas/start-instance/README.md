# EC2 Instance Starter Lambda

This Lambda function starts an EC2 instance if it's stopped. If the instance is already running, it does nothing.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Install Serverless Framework globally:
```bash
npm install -g serverless
```

3. Configure AWS credentials:
```bash
serverless config credentials --provider aws --key YOUR_ACCESS_KEY --secret YOUR_SECRET_KEY
```

4. Update the `.env` file with your EC2 instance ID:
```
EC2_INSTANCE_ID=i-your-instance-id-here
```

## Deployment

Deploy the Lambda function:
```bash
serverless deploy
```

## Usage

Once deployed, you can trigger the Lambda function by making a GET request to the generated endpoint:

```bash
curl https://your-api-gateway-url/dev/start-instance
```

## Response

The function returns JSON with the following possible responses:

- **Instance already running**:
```json
{
  "message": "Instance i-xxxxxxxxxxxxxxxxx is already running",
  "state": "running"
}
```

- **Instance starting**:
```json
{
  "message": "Instance i-xxxxxxxxxxxxxxxxx is starting",
  "previousState": "stopped",
  "newState": "pending"
}
```

- **Instance in other state**:
```json
{
  "message": "Instance i-xxxxxxxxxxxxxxxxx is in state: stopping",
  "state": "stopping"
}
```

- **Error responses**:
```json
{
  "error": "EC2_INSTANCE_ID environment variable not set"
}
```

## IAM Permissions

The Lambda function requires the following IAM permissions:
- `ec2:DescribeInstances`
- `ec2:StartInstances`

These are automatically configured in the `serverless.yml` file.