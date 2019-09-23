# FortiGate aws-lambda-guardduty

This repository contains source code for the `aws-lambda-guardduty` function.

This AWS Lambda function translates feeds from AWS GuardDuty findings into a list of malicious IP addresses that are then stored in an S3 bucket. A FortiGate can then consume this list as an external threat feed.

# Background

AWS GuardDuty is a managed threat detection service that monitors malicious or unauthorized behaviors/activities related to AWS resources. AWS GuardDuty provides visibility of logs called findings, and Fortinet provides a Lambda function that is invoked based on events happening in the findings and will create a list of malicious IP addresses which are then stored in an S3 Bucket. FortiGate can then be configured to point to this S3 bucket as the external feed of threat vectors.

AWS GuardDuty findings give visibility on the following:
*  **Severity:** High/medium/low (associated with scores)
* **Where the behavior/activity occurred:** Region, resource ID, account ID
* **When:** Last seen date/time
* **Count**
* **Detailed information:**
   - *Affected resource:* type/instance ID/image ID/port/resource type/image description/launch time/tags/network interfaces (public IP, private IP, subnet ID, VPCID, security groups)
   - *Action:* type/connection direction
   - *Actor*
   - *Additional*

For more information on Amazon GuardDuty, refer to the [Amazon GuardDuty official website](https://aws.amazon.com/guardduty/).

# Planning

## Requirements
This function requires:
* FortiOS 6.0.0 or higher
* An [AWS account](https://aws.amazon.com/)
* A subscription to GuardDuty. For more information on GuardDuty, refer to the article [Getting Started with Amazon GuardDuty](https://aws.amazon.com/guardduty/getting-started/).
* [Node.js](https://nodejs.org/) (8.10.0+). Choose the version available for your OS (e.g. Windows, Linux, macOS).
* [npm](https://www.npmjs.com/). A Node version manager should be used to install Node.js and npm. For more information, refer to the article [Downloading and installing Node.js and npm](https://docs.npmjs.com/getting-started/installing-node#installing-npm-from-the-nodejs-site). Choose the version available for your OS (e.g. Windows, Linux, macOS).
* [Git](https://git-scm.com/downloads) (latest version). Choose the version available for your OS (e.g. Windows, Linux, macOS).

If you are on the Windows platform, you will also need:
* [Git Bash](https://gitforwindows.org/) (latest version).This is a Windows platform solution for performing the installation steps. For more information on setting up Git Bash on Windows, refer to the article [Use git, ssh and npm on windows with Git Bash](https://blog.theodo.fr/2017/01/use-git-ssh-and-npm-on-windows-with-git-bash/).

## Prerequisite Knowledge
Installing and configuring the FortiGate `aws-lambda-guardduty` function requires knowledge of the following:
  - CLI (Command Line Interface)
  - AWS Lambda function, DynamoDB, S3 bucket, and IAM
  - Node.js

## Security
*Step 4. Create an IAM role with the required permissions* describes how to create a dedicated AWS IAM role to run this Lambda function. This role will have limited permissions in order to restrict operations to a dedicated S3 bucket resource and to this function only.

It is never recommended to attach a full control policy such as `AmazonS3FullAccess`, which has full permissions to all resources under your Amazon AWS account, to the role which runs the Lambda function. Allowing full-access permissions to all resources may put your resources at risk.

# Installation
> **Note:** For Windows be sure `zip.exe` is available in the `%PATH%` (e.g. install from http://gnuwin32.sourceforge.net/packages/zip.htm and run `PATH=%PATH%;"c:\Program Files (x86)\GnuWin32\bin\"`, `$Env:PATH += ";c:\Program Files (x86)\GnuWin32\bin\"` or `export PATH=$PATH:/c/Program\ Files\ \(x86\)/GnuWin32/bin` depending on the shell )

## Step 1. Prepare the deployment package
Create the deployment package from the local git project repository. In *Step 5. Create the Lambda function*, this package will be uploaded during Lambda function creation.

1. Clone this project into the **guardduty** folder of your current local directory, and enter the project directory.

    ```sh
    $ git clone https://github.com/fortinet/aws-lambda-guardduty.git guardduty
    $ cd guardduty
    ```

2. Install project dependencies.

    ```sh
    $ npm install
    ```

3. Build this project locally.

    ```sh
    $ npm run build
    ```
The deployment package **aws_lambda_guardduty.zip** will be available in the **dist** directory.

## Step 2. Create an S3 bucket

One S3 bucket is needed for the Lambda function to store the IP block list.

Create the S3 bucket and make note of the name as it will be used later. In these instructions, the S3 bucket name will be ***my-aws-lambda-guardduty***.

> **Notes:**
> * The Amazon S3 [Rules for Bucket Naming](https://docs.aws.amazon.com/AmazonS3/latest/dev/BucketRestrictions.html#bucketnamingrules) require bucket names to be "unique across all existing bucket names in Amazon S3".
> * This S3 bucket is required to run this project.
> * Although S3 bucket creation is region-specific, once created, the S3 bucket can be accessed from any region.
> * Do not grant the S3 bucket public access permissions.
> * The Lambda function points to this S3 bucket through its *S3_BUCKET* environment variable.

## Step 3. Create a DynamoDB table

One DynamoDB table with the stream feature enabled is required to store records of malicious IP addresses from GuardDuty Findings.

> **Notes:**
> * DynamoDB tables and Lambda functions are region-specific so you must create the table and the Lambda function in the same AWS region.
> * A DynamoDB trigger on this table will be created to cause the Lambda function to execute. Since the Lambda function hasn't been created yet, instructions to create the trigger will be provided later in *Step 6. Create a DynamoDB stream trigger*.

In these instructions, the DynamoDB table name will be ***my-aws-lambda-guardduty-db***.

1. In the AWS console, select **Services > Database > DynamoDB**.
2. Click **Create table**.
3. Enter a **Table name**.
4. For the **Primary key Partition key**:
   * Enter the value *finding_id*. This value is case-sensitive.
   * From the dropdown list, select **String**.
5. Check the **Add a sort key** checkbox:
   * Enter the value *ip*. This value is case-sensitive.
   * From the dropdown list, select **String**.
6. Under **Table settings**, check **Use default settings**.
7. Click **Create** to create the table.
8. Select the table to display table information.
9. On the **Overview** tab, under **Stream details**, click on **Manage Stream**.
10. Select the **Keys only** option, then click on **Enable**.
11. Also listed under **Stream details** is the **Latest stream ARN**. Make note of this as you will need it in the IAM policy creation step.

## Step 4. Create an IAM role with the required permissions

To run the Lambda function across AWS services, an IAM role with the following permissions is required:

| AWS Service | Permission |
| - | - |
| S3 | ListBucket, HeadBucket, GetObject, PutObject, PutObjectAcl |
| DynamoDB | DescribeStream, ListStreams, Scan, GetShardIterator, GetRecords, UpdateItem |

The Lambda function also needs permission to write logs to CloudWatch. This permission is available in the AWS-managed policy **AWSLambdaBasicExecutionRole**.

Two user-managed policies will be created:
* A policy which grants an IAM role permissions to operate on the S3 bucket ***my-aws-lambda-guardduty***.
* A policy which grants an IAM role permissions to operate on the DynamoDB table ***my-aws-lambda-guardduty-db***.

To create a user-managed policy:

1. In the AWS console, select **Services > Security, Identity & Compliance > IAM**.
2. In the left navigation column, click **Policies**.
3. Click **Create policy**.

**For the policy which grants permissions to operate on the S3 bucket:**
1. For **Service**, select **S3**.
2. For **Actions**, select the following **Access level** items:
   - *List > ListBucket*
   - *List > HeadBucket*
   - *Read > GetObject*
   - *Write > PutObject*
   - *Permissions management > PutObjectAcl*
3. For **Resources**, ensure that **Specific** is selected and then **Add ARNs** for each resource type to restrict access to any file in the specified bucket only.
   * For the **bucket** resource type:
     1. Click **Add ARN**.
     2. In the popup, enter the **Bucket name** (***my-aws-lambda-guardduty***) and the ARN is created automatically (***arn:aws:s3:::my-aws-lambda-guardduty***).
     3. Click **Add**.
   * For the **object** resource type:
     1. Click **Add ARN**.
     2. In the popup, create the ARN by entering the **Bucket name** (***my-aws-lambda-guardduty***) and a wildcard for the **Object name** (or check the **Any** box). The ARN is created automatically (***arn:aws:s3:::my-aws-lambda-guardduty/****).
     3. Click **Add**.
4. Click on **Review Policy**.
5. Enter a **Name** for the policy.
6. (Optional) Enter a **Description** for the policy.
7. Click **Create policy**.

This policy in JSON form looks like the code snippet below:
```sh
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:ListBucket",
                "s3:PutObjectAcl"
            ],
            "Resource": [
                "arn:aws:s3:::my-aws-lambda-guardduty",
                "arn:aws:s3:::my-aws-lambda-guardduty/*"
            ]
        },
        {
            "Sid": "VisualEditor1",
            "Effect": "Allow",
            "Action": "s3:HeadBucket",
            "Resource": "*"
        }
    ]
}
```

**For the policy which grants permissions to operate on the DynamoDB table:**
1. For **Service**, select **DynamoDB**.
2. For **Actions**, select the following **Access level** items:
   - *Read > DescribeStream*
   - *Read > GetRecords*
   - *Read > GetShardIterator*
   - *Read > ListStreams*
   - *Read > Scan*
   - *Write > UpdateItem*
3. For **Resources**, ensure that **Specific** is selected and then **Add ARNs** for each resource type to restrict access to restrict access to any stream resource in the specified table only.
   * For the **stream** resource type:
     1. Click **Add ARN**.
     2. In the popup, create the ARN by entering the information for your environment:
        - **Region:** *your-region*
        - **Account:** *your-account-id*
        - **Table name:** *my-aws-lambda-guardduty-db*
        - **Stream label:** \* (or check the **Any** box)
     3. Click **Add**.
     * The ARN is created automatically (***arn:aws:dynamodb:your-region:your-account-id:table/my-aws-lambda-guardduty-db/stream/****).
     * Alternatively, you can paste in the **Latest stream ARN** and replace the **Stream label** with the **\*** wildcard.  The **Latest stream ARN** is found on the **Overview** tab when selecting the DynamoDB table (**Services > Database > DynamoDB > Tables > my-aws-lambda-guardduty-db**).
   * For the **table** resource type:
     1. Click *Add ARN*.
     2. In the popup, create the ARN by entering the information for your environment:
        - **Region:** *your-region*
        - **Account:** *your-account-id*
        - **Table name:** *my-aws-lambda-guardduty-db*
     3. Click **Add**.
     * The ARN is created automatically (***arn:aws:dynamodb:your-region:your-account-id:table/my-aws-lambda-guardduty-db***).
4. Click on **Review Policy**.
5. Enter a **Name** for the policy.
6. (Optional) Enter a **Description** for the policy.
7. Click **Create policy**.

This policy in JSON form looks like the code snippet below:
``` sh
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetShardIterator",
                "dynamodb:Scan",
                "dynamodb:UpdateItem",
                "dynamodb:DescribeStream",
                "dynamodb:GetRecords"
            ],
            "Resource": [
                "arn:aws:dynamodb:your-region:your-account-id:table/my-aws-lambda-guardduty-db/stream/*",
                "arn:aws:dynamodb:your-region:your-account-id:table/my-aws-lambda-guardduty-db"
            ]
        },
        {
            "Sid": "VisualEditor1",
            "Effect": "Allow",
            "Action": "dynamodb:ListStreams",
            "Resource": "*"
        }
    ]
}
```
Next, create an IAM role to run the Lambda function:
1. In the AWS console, select **Services > Security, Identity & Compliance > IAM**.
2. In the left navigation column, click **Roles**.
3. Click **Create role**.
4. For **Choose the service that will use this role**, select **Lambda**.
5. Click **Next: Permissions**.
6. **Attach permissions policies** by searching for and selecting:
   * the two user-managed policies created above
   * the AWS-managed policy **AWSLambdaBasicExecutionRole**
7. Click **Next: Tags**.
8. Click **Next: Review**.
9. Enter a **Role name**.
6. (Optional) Enter a **Role description**.
7. Click **Create role**.

## Step 5. Create the Lambda function

The Lambda function is created with the deployment package generated in *Step 1. Prepare the deployment package*. It has five configurable environment variables:

| Variable Name | Type | Description |
| ------ | ------ | ------ |
| MIN_SEVERITY | Integer |The minimum severity required to block an IP address. Values can range from 0.1 to 8.9. The default value is 3.<br> For information on GuardDuty severity levels, refer to the article [Severity Levels for GuardDuty Findings](https://docs.aws.amazon.com/guardduty/latest/ug/guardduty_findings.html#guardduty_findings-severity). |
| S3_BUCKET | Text | The S3 bucket name to store the **IP block list** file. This must be specified as there is no default value. |
| S3_BLOCKLIST_KEY | Text | The  relative file path to the **IP block list** file within the S3 bucket. This must be specified as there is no default value. |
| REGION | Text | The AWS Region in which to run these services: Lambda, DynamoDB. This must be specified as there is no default value.<br> For information on determining the Region based on the Region Name, refer to the AWS article [AWS Regions and Endpoints](https://docs.aws.amazon.com/general/latest/gr/rande.html). |
| DDB_TABLE_NAME | Text | The DynamoDB table name which stores malicious IP addresses obtained from the findings. This must be specified as there is no default value. |

To create the Lambda function:
1. In the AWS Console, select **Services > Compute > Lambda**.
2. Click **Create (a) function**.
3. Select **Author from scratch** and enter **Basic information** as follows:
   * **Function name:** Enter a unique name of your choosing.
   * **Runtime:** Select **Node.js 8.10**.
   * **Permissions:** Select **Use an existing role** and then select the role created in *Step 4. Set up an IAM role and attach policies*.
4. Click **Create function**.
5. Locate the **Function code** area.
6. Under **Code entry type**, select **Upload a .zip file**.
7. Under *Function package*, click **Upload**.
8. Navigate to the **.dist** directory and select the deployment package **aws_lambda_guardduty.zip** generated in *Step 1. Prepare the deployment package*.
9. For **Handler**, enter **index.handler**.
10. Under **Environment variables**, add the following key-value pairs:
    | Key | Value |
    | ------ | ------ |
    | **MIN_SEVERITY** | *3* |
    | **S3_BUCKET** | The name of the S3 bucket created in *Step 2. Create an S3 bucket* (***my-aws-lambda-guardduty***) |
    | **S3_BLOCKLIST_KEY** |*ip_blocklist* (or something else as the name of a file to store the malicious IP addresses.) |
    | **REGION** | The AWS Region where your Lambda function and DynamoDB table are located. |
    | **DDB_TABLE_NAME** | The name of the DynamoDB table created in *Step 3. Create a DynamoDB table*. (***my-aws-lambda-guardduty-db***) |
11. Under **Basic settings**, change the **Timeout** from **3** sec to **15** sec.
12. Click **Save**.

## Step 6. Create a DynamoDB stream trigger

A DynamoDB stream trigger is what causes the Lambda function to  create the ip blocklist file and store it in the S3 bucket.

1. In the AWS console, select **Services > Database > DynamoDB**.
2. In the left nagivation columm, click **Tables**.
3. Click the **Name** of the DynamoDB table created in *Step 3. Create a DynamoDB table* (***my-aws-lambda-guardduty-db***).
4. Click the **Triggers** tab.
5. Click **Create Trigger** and then from the dropdown, select **Existing Lambda function**.
6. For **Function**, select the Lambda function created in *Step 5. Create the Lambda function*.
7. For **Batch size**, leave the default value of *100*.
8. Ensure **Enable trigger** is selected.
9. Click **Create**.

# Post-Installation configuration

To work with the Lambda function AWS CloudWatch and GuardDuty services need some additional configuration.

## Create a CloudWatch event rule

A CloudWatch event rule is used to invoke the Lambda function to collect the malicious IP addresses and save them in the DynamoDB table. The event rule is triggered based on events happening in GuardDuty findings.

To create an event rule:
1. In the AWS console, select **Services > Management & Governance > CloudWatch**.
2. In the left nagivation columm, click **Rules**.
3. Click **Create Rule**.
4. Under **Event Source**:
   - Select **Event Pattern**.
   - From the dropdown list, ensure **Events by Service** is selected.
   - For **Service Name**, select **GuardDuty**.
   - For **Event Type**, select **GuardDuty Finding**.
   - Confirm that the **Event Pattern Preview** looks like the code snippet below.
     ```sh
     {
       "source": [
         "aws.guardduty"
       ],
       "detail-type": [
         "GuardDuty Finding"
       ]
     }
     ```
5. Under *Targets*:
    - Click **Add Target\***.
    - From the dropdown list, ensure **Lambda function** is selected.
    - For **Function**, select the Lambda function you created in *Step 5. Create the Lambda function*.
6. Click **Configure details**.
7. Enter a **Name** (E.g. ***aws-lambda-guardduty-finding-event-rule***).
8. For State, check the **Enabled** checkbox.
9. Click **Create Rule**.

## Run a test from the Lambda function
When all services have been created, verify the the installation by creating and running a test event from the Lambda function.

To create a test event:
1. In the AWS Console, select **Services > Compute > Lambda**.
2. In the left nagivation columm, click **Functions**.
3. Locate the Lambda function created in *Step 5. Create the Lambda function* and click on the **Function name**.
4. From the **Select a test event** dropdown, select *Configure test events*.
5. Select **Create new test event**.
6. Paste the following code into the text box.
   ```sh
   {
     "id": "fa9fa4a5-0232-188d-da1c-af410bcfc344",
     "detail": {
       "service": {
         "serviceName": "guardduty",
         "action": {
           "networkConnectionAction": {
             "connectionDirection": "INBOUND",
             "remoteIpDetails": {
               "ipAddressV4": "192.168.123.123"
             }
           }
         },
         "additionalInfo": {
           "threatListName": "GeneratedFindingThreatListName"
         },
         "eventLastSeen": "2018-07-18T22:12:01.720Z"
       },
       "severity": 3
     }
   }
   ```
7. Click **Create**.

To execute the Lambda function with the test event:
1. From the **Select a test event** dropdown, select the event you just created.
2. Click the **Test** button.

Ensure **Execution result: succeeded** is at the top of the page and then review the results of the test. Look for the following:
* A record with a *finding_id* of ***fa9fa4a5-0232-188d-da1c-af410bcfc344*** and an *ip* of ***192.168.123.123*** is in the DynamoDB table ***my-aws-lambda-guardduty-db***.
* The file **ip_blocklist** resides in the S3 bucket ***my-aws-lambda-guardduty***.
* The file **ip_blocklist** has the *Read object* permission for *Everyone* under the *Public access* section.
* The file **ip_blocklist** is accessible in a browser using its link (e.g. https://s3-***your-region***.amazonaws.com/***my-aws-lambda-guardduty***/ip_blocklist).
* Check that the file **ip_blocklist** contains the line **192.168.123.123**.

## Generate Sample Findings in GuardDuty (Optional)
Amazon GuardDuty monitors your AWS infrastructure on a continuous basis to detect malicious or unauthorized behavior  and creates records based on such findings.

If you are subscribing to GuardDuty for the first time, the *Findings* list will be empty. To generate some samples, go to **Settings** and click **Generate sample findings**. Several dummy findings marked as “[SAMPLE]” will be created.

As long as you have set up the Lambda function and CloudWatch correctly, some of those *sample findings* will trigger the CloudWatch event rule to run the Lambda function. A few new IP addresses will eventually appear in the **ip_blocklist**.

## Set up the FortiGate(s)
Instructions can be found in FortiGate documentation in the GuardDuty integration section.

## Clean up
Since test events and sample findings can update the **ip_blocklist** with sample IP addresses, it is highly recommended that you clean up the **ip_blocklist**  prior to production use.

Clean up is done by removing the **ip_blocklist** from the S3 bucket and clearing the DynamoDB table:
1. Delete all records from the DynamoDB table created in *Step 3. Create a DynamoDB table*. (***my-aws-lambda-guardduty-db***).
2. Delete the ***ip_blocklist*** file from the S3 bucket created in *Step 2. Create an S3 bucket* (***my-aws-lambda-guardduty***).

# Support
Fortinet-provided scripts in this and other GitHub projects do not fall under the regular Fortinet technical support scope and are not supported by FortiCare Support Services.
For direct issues, please refer to the [Issues](https://github.com/fortinet/azure-security-group-update/issues) tab of this GitHub project.
For other questions related to this project, contact [github@fortinet.com](mailto:github@fortinet.com).

## License
[License](./LICENSE) © Fortinet Technologies. All rights reserved.
