# AWS Elastic Beanstalk Deployment Guide for SmartAMS

## Prerequisites

1. **AWS Account** with billing enabled
2. **AWS CLI** installed: https://aws.amazon.com/cli/
3. **EB CLI** installed:
   ```bash
   pip install awsebcli --upgrade --user
   ```
4. **Git** configured
5. **Supabase** project already created (no RDS needed)

---

## Step 1: Configure AWS Credentials

```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter default region (e.g., us-east-1)
# Enter default output format (json)
```

Or set environment variables:
```bash
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_DEFAULT_REGION=us-east-1
```

---

## Step 2: Initialize Elastic Beanstalk

Navigate to your project directory and initialize EB:

```bash
cd "/Users/loki/Downloads/smart-ams 3"
eb init -p "Node.js 20 running on 64bit Amazon Linux 2" \
  --region us-east-1 \
  --instance-profile aws-elasticbeanstalk-ec2-role
```

Follow the prompts:
- **Application name**: `smart-ams`
- **Environment name**: `smart-ams-prod` (or your choice)
- **SSH**: Set up SSH for your instances (recommended)

---

## Step 3: Create Environment Variables File

Create `.ebextensions/04-environment-variables.config`:

```bash
cat > .ebextensions/04-environment-variables.config << 'EOF'
option_settings:
  aws:elasticbeanstalk:application:environment:
    SUPABASE_URL: your_supabase_url
    SUPABASE_ANON_KEY: your_supabase_anon_key
    SUPABASE_SERVICE_ROLE_KEY: your_supabase_service_role_key
    NODE_ENV: production
    FLASK_ENV: production
    FLASK_DEBUG: "0"
EOF
```

**Get your Supabase keys:**
- Go to Supabase Project Settings → API
- Copy: `Project URL` and `anon public key` and `service_role key`
- Replace in the config above

---

## Step 4: Create the Environment & Deploy

```bash
eb create smart-ams-prod \
  --instance-type t3.medium \
  --scale 1
```

Or deploy to an existing environment:

```bash
eb deploy
```

Monitor deployment:
```bash
eb logs --stream
```

---

## Step 5: Verify Deployment

Check environment status:
```bash
eb status
```

Get the environment URL:
```bash
eb open
```

Test endpoints:
```bash
curl http://your-eb-domain.us-east-1.elasticbeanstalk.com/
curl http://your-eb-domain.us-east-1.elasticbeanstalk.com/api/health
```

---

## Step 6: Set Up Custom Domain (Optional)

1. Get your EB domain:
   ```bash
   eb printenv | grep CNAME
   ```

2. In your DNS provider (Route 53, GoDaddy, etc.), add a CNAME record:
   - **Name**: `yourdomain.com` or `ams.yourdomain.com`
   - **Target**: Your EB domain (e.g., `smart-ams-prod.us-east-1.elasticbeanstalk.com`)

3. Configure EB to accept custom domain:
   ```bash
   eb setenv DOMAIN_NAME=yourdomain.com
   ```

---

## Step 7: Enable HTTPS (AWS Certificate Manager)

1. Create SSL certificate in AWS Certificate Manager (free)
2. Attach to EB environment through AWS Console or:
   ```bash
   eb config
   ```
   Find load balancer settings and assign certificate

---

## Step 8: Monitor & Logs

View real-time logs:
```bash
eb logs --stream
```

View environment health:
```bash
eb health
```

SSH into instance (for debugging):
```bash
eb ssh
```

---

## Step 9: Environment Variables Management

Update environment variables without redeploying:
```bash
eb setenv VAR_NAME=value
```

View current environment variables:
```bash
eb printenv
```

---

## Scaling Configuration

### Auto-scaling (Recommended)

```bash
eb scale 2  # Set to 2 instances
```

Configure auto-scaling rules via AWS Console:
- Go to EB Environment → Configuration → Capacity
- Set Min/Max instances (e.g., 1-3)
- Set scale-up/down triggers based on CPU %

### Instance Type Changes

```bash
eb scale --instance-type t3.large
```

Available types:
- `t3.micro` — Free tier (limited)
- `t3.small` — 2GB RAM, ~$15/mo
- `t3.medium` — 4GB RAM (~$30/mo) ← **Recommended**
- `t3.large` — 8GB RAM (~$60/mo)

---

## Cost Breakdown (Monthly Estimate)

| Component | Tier | Cost |
|-----------|------|------|
| **EC2 Instance** | t3.medium (730 hrs) | $30 |
| **Data Transfer** | 100GB outbound | $8.50 |
| **Load Balancer** | (if enabled) | $15 |
| **Supabase** | Free/Pro | $0-25 |
| **Total** | | **~$45-75/mo** |

---

## Troubleshooting

### Out of Memory Errors
Increase instance type:
```bash
eb scale --instance-type t3.large
```

### Application Not Starting
Check logs:
```bash
eb logs --stream
```

SSH and check:
```bash
eb ssh
sudo tail -f /var/log/eb-activity.log
```

### Python Dependency Issues
Force pip rebuild:
```bash
eb setenv REBUILD_DEPENDENCIES=true
eb deploy
```

### Port Already in Use
Ensure Flask runs on port 5000 and Node on port 3000 in your code.

---

## Commands Reference

```bash
eb init              # Initialize EB project
eb create            # Create new environment
eb deploy            # Deploy code changes
eb scale N           # Scale to N instances
eb setenv VAR=val    # Set environment variable
eb open              # Open in browser
eb status            # Show environment status
eb health            # Show health metrics
eb logs --stream     # Stream live logs
eb ssh               # SSH into instance
eb terminate         # Delete environment
eb clone             # Clone environment
```

---

## Next Steps

1. **Commit all new files:**
   ```bash
   git add .ebextensions/ Procfile
   git commit -m "Add Elastic Beanstalk configuration"
   git push origin main
   ```

2. **Deploy:**
   ```bash
   eb deploy
   ```

3. **Monitor & test in AWS Console** or via CLI

---

## Support & Docs

- AWS EB Docs: https://docs.aws.amazon.com/elasticbeanstalk/
- EB CLI Docs: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/eb-cli3.html
- Supabase Docs: https://supabase.com/docs
