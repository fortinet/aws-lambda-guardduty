# aws-lambda-guardduty

aws-lambda-guardduty is an AWS Lambda function that translates feeds from AWS GuardDuty findings into a list of malicious IP addresses in an S3 bucket, which a FortiGate can consume as an external threat feed.

This project is a feature for AWS GuardDuty integration for FortiGate. The feature is compatible for FortiOS 6.0.0+.

This repository contains:

1. Source code of aws-lambda-guardduty.

The Installation section of this file provide a quick installation and configuration guide for advanced users with knowledge of:
  - CLI (Command Line Interface)
  - AWS Lambda function, DynamoDB, S3 bucket, and IAM
  - Node.js

## Security
It is highly recommended that you create a dedicated AWS IAM role to run this Lambda function. The role should have limited permissions in order to restrict operation on a dedicated S3 bucket resource for this project only.

It is never suggested to attach a full control policy such as 'AmazonS3FullAccess', which has full permissions to all resources under your Amazon AWS account, to the role which runs the Lambda function. Allowing full-access permissions to all resources may put your resources at risk.


# Background

> AWS GuardDuty is a managed threat detection service that monitors malicious or unauthorized behaviors/activities related to AWS resources. GuardDuty provides visibility of logs called findings, and Fortinet provides a Lambda script that populates a list of malicious IP addresses then stores it in an S3 location. FortiGate can then be configured to point to the location as the external feed of threat vectors.

 GuardDuty findings give visibility on the following:
  - Severity: High/medium/low (associated with scores)
  - Where the behavior/activity occurred: Region, resource ID, account ID
  - When: Last seen date/time
  - Count
  - Detailed information
    - Affected resource: type/instance ID/image ID/port/resource type/image description/launch time/tags/network interfaces (public IP, private IP, subnet ID, VPCID, security groups)
    - Action: type/connection direction
    - Actor
    - Additional

For more information about Amazon GuardDuty, please see the [Amazon GuardDuty official website](https://aws.amazon.com/guardduty/).

## Usage
### Configurable Variables
> There are five configurable environment variables in the Lambda function.

| Variable Name | Type | Description |
| ------ | ------ | ------ |
| MIN_SEVERITY | Integer |The minimum severity to block an IP address. Defaults to **3**. Value ranges from **1** to **10** by [AWS GuardDuty definition](https://docs.aws.amazon.com/guardduty/latest/ug/guardduty_findings.html#guardduty_findings-severity).|
| S3_BUCKET | Text | S3 bucket name to store the **ip block list** file. No default value. Must specify.
| S3_BLOCKLIST_KEY | Text | Path to the **ip block list** file within the S3 bucket. No default value. Must specify. The relative file path to the S3 bucket. |
| REGION | Text | AWS Region to run these services: Lambda, DynamoDB. Must Specify. |
| DDB_TABLE_NAME | Text | DynamoDB table name which stores malicious IP addresses from Findings. Must specify. |

### Required Permissions for IAM Role
> Here is a list of permissions for the IAM role to run this project across AWS Services.

| AWS Service | Permission |
| - | - |
| S3 | ListBucket, HeadBucket, GetObject, PutObject, PutObjectAcl |
| DynamoDB | DescribeStream, ListStreams, Scan, GetShardIterator, GetRecords, UpdateItem |

## Install

>You can follow the installation steps below to setup this Lambda function.

### Prerequisites

See below for a list of tools required to deploy this project before installation. Some prerequisites are platform-specific. Choose the right one for your OS (e.g. Windows, Linux, macOS)
  - [Node.js](https://nodejs.org/) (v8.10.0 or later)
  - [Npm](https://www.npmjs.com/). Although npm comes with Node.js, check [here](https://docs.npmjs.com/getting-started/installing-node#installing-npm-from-the-nodejs-site) for how to install npm and manage npm version.
  - [AWS account](https://aws.amazon.com/).
  - [Git](https://git-scm.com/downloads) (latest version).
  - *[Git Bash]() (latest version). Git Bash is a solution for Windows platform users to run the following installation steps. The article [Use git, ssh and npm on windows with Git Bash](https://blog.theodo.fr/2017/01/use-git-ssh-and-npm-on-windows-with-git-bash/) gives more information about setting up Git Bash on Windows.

### Installation Steps
When you have all prerequisites ready, you can continue the installation steps as below. Please note the commands in each steps are intended to run in Terminal or Git Bash only.

### Step 1. Prepare the deployment package
>We need to create a **deployment package** from the local git project repository, which will be uploaded for the Lambda function creation in a later step.

1. Clone this project into the 'guardduty' folder in your current local directory, and enter the project directory.

```sh
$ git clone https://github.com/fortinet/aws-lambda-guardduty.git guardduty
$ cd guardduty
```

2. Install project dependencies.

```sh
$ npm install
```

3. Build this project locally to create a **deployment package** .zip file. The file will be located in ./dist/aws_lambda_guardduty.zip.

```sh
$ npm run build
```
### Step 2. Setup S3 bucket
>One S3 bucket is needed for this project. The S3 bucket to be created in the following steps is given an example. The name is **bold** and *italic*, and is referred to in some other steps. Additionally, the bucket name will be used in some configuration steps so please write it down.
>Regarding the bucket naming limitation in Amazon S3 service, each bucket should have a globally unique name. Hence, you should not use the same name as the example's in this README.

1. Create the S3 bucket to store the IP block list.
(This bucket is named ***my-aws-lambda-guardduty***, as an example)
    - This bucket is required to run this project.
    - Although bucket creation is region-specific, once created, the bucket can be accessed from any region.
    - Do not grant the bucket public access permissions.
    - The Lambda function points to this bucket through its *S3_BUCKET* environment variable.

### Step 3. Setup DynamoDB table.
> One DynamoDB table with the stream feature enabled is required to store records of malicious IP addresses from GuardDuty Findings.
Note DynamoDB tables and Lambda functions are region-specific so you must create the table and the Lambda function in the same AWS region.
> Note a DynamoDB trigger on this table will be created to cause the Lambda function to execute. Since the Lambda function hasn't been created yet, instructions to create the trigger will be provided later in Step 6.

1. Create the DynamoDB table.
(This table is named ***my-aws-lambda-guardduty-db***, as an example)
    - For *Primary key*,
        - input a value **finding_id**. This value is case-sensitive.
        - choose **String** from the dropdown list as its data type.
    - Add a *sort key*,
        - input a value **ip**. This value is case-sensitive.
        - choose **String** from the dropdown list as its data type.
    - Checked use default settings for *Table settings*.
    - Click on **Create** to finish.
2. Enable Stream feature on this table.
    - On the Overview tab, click on **Manage Stream**, choose **Keys only** option, then click on **Enable** to save.
    - Write down the *Latest stream ARN*. This ARN will be used in the IAM policy creation step.

### Step 4. Setup IAM role and policies
>An IAM role is created to run the Lambda function. Three policies attach to the IAM role. The first one is a user-managed policy which grants permissions to operation on the S3 bucket ***my-aws-lambda-guardduty***. The second one is a user-managed policy which grants permission to operation on the DynamoDB table ***my-aws-lambda-guardduty-db***. The third one is an AWS-managed policy which allows the Lambda function to write logs to CloudWatch.

1. Create one policy to operate on the S3 bucket.
    - Choose **S3** as its service.
    - In Access level, add **ListBucket** on List, **HeadBucket**, **GetObject** on Read, **PutObject** on Write, **PutObjectAcl** on Permissions management.
    - In Resources, choose **Specific**.
        - For the **bucket** resource type, add the ***my-aws-lambda-guardduty*** S3 bucket ARN (e.g. *arn:aws:s3:::my-aws-lambda-guardduty*) to restrict access to any file in the specific bucket only.
        - For the **object** resource type, add the ***my-aws-lambda-guardduty*** S3 bucket ARN and a **/\*** wildcard (e.g. *arn:aws:s3:::my-aws-lambda-guardduty/**) to restrict access to any file in the specific bucket only.
    - Click on **Review Policy** button, then **Save Changes** button.
    - The policy in JSON form looks like the code snippet below:
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

2. Create one policy to operate on the DynamoDB table.
    - Choose **DynamoDB** as its service.
    - In Access level, add **ListStreams** on List, **DescribeStream**, **GetRecords**, **GetShardIterator**, **Scan** on Read, and **UpdateItem** on Write.
    - In Resources, choose **Specific**.
        - For the **stream** resource type, add the ***my-aws-lambda-guardduty-db*** latest stream ARN (e.g. *arn:aws:dynamodb:us-east-1:888888888888:table/my-aws-lambda-guardduty-db/2018-07-20T10:30:10.888*) , replace the **Stream label** content with the **\*** wildcard to allow for access to any stream resource of the ***my-aws-lambda-guardduty-db*** table.
        - For the **table** resource type, add the ***my-aws-lambda-guardduty-db*** DynamoDB table ARN (e.g. *arn:aws:dynamodb:us-east-1:888888888888:table/my-aws-lambda-guardduty-db*) to restrict access to the specific table only.
    - Click on **Review Policy** button, then **Save Changes** button.
    - The policy in JSON form looks like the code snippet below:
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
                "arn:aws:dynamodb:us-east-1:888888888888:table/my-aws-lambda-guardduty-db/stream/*",
                "arn:aws:dynamodb:us-east-1:888888888888:table/my-aws-lambda-guardduty-db"
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

3. Create one IAM role to run the Lambda function.
    - Choose **Lambda** service that will use this role.
    - Attach the two user-managed policies created on the previous sub-steps to this role.
    - Attach the AWS-managed policy **AWSLambdaBasicExecutionRole** to this role.

### Step 5. Create the Lambda function
> The Lambda function will be created with the deployment package generated in *Step 1. Prepare the deployment package*. This package will be uploaded directly to this Lambda function.
> The Lambda function has five configurable environment variables for severity, AWS region, DynamoDB table name, and IP block list file entry point.

1. Create a function that **author from scratch**.
    - Give it a unique name.
    - Choose **Node.js 8.10** as its Runtime.
    - For Role, select **Choose an existing role**. Choose the role created in *Step 4. Setup IAM role and policies*.

2. Setup **function code**.
    - For code entry type, choose **Upload a .ZIP file**. Then the *Function package* field will show up.
    - For Function package, click the **Upload** button to upload your deployment package .zip file. This deployment package was generated in Step 1. Prepare the deployment package.
    - For Handler, type in **index.handler**.
3. Setup **environment variables**.
    - Note values for key fields are case-sensitive and should be all in upper case.
    - Add a key **MIN_SEVERITY** and input a value of **3**.
    - Add a key **S3_BUCKET** and paste the name of the S3 bucket created in *Step 2. Setup S3 bucket* (**my-aws-lambda-guardduty** in this example)
    - Add a key **S3_BLOCKLIST_KEY** and input a value of **ip_blocklist** or a different name as you wish.
    - Add a key **REGION** and input the AWS region where your Lambda function and DynamoDB table are situated. For example, the region of *US East (N. Virginia)* is *us-east-1*. For information about AWS Regions, please see [AWS Regions and Endpoints](https://docs.aws.amazon.com/general/latest/gr/rande.html).
    - Add a key **DDB_TABLE_NAME** and input the name of the DynamoDB table you have created in Step 3. (***my-aws-lambda-guardduty-db*** in this example)

4. Setup **Basic settings**
    - Change Timeout from **3** sec to **15** sec

5. Save the Lambda function.

### Step 6. Setup DynamoDB stream trigger
> A trigger needs to add to the DynamoDB table created in Step 4. Setup DynamoDB table. This trigger is the key to cause the Lambda function to generator a full IP block list to a static file in the S3 bucket.
1. Create a trigger on the DynamoDB table (***my-aws-lambda-guardduty-db*** in this example).
    - In DynamoDB, click on the table ***my-aws-lambda-guardduty-db*** to toggle on its detail window.
    - Click on the **Triggers** tab, and click on the **Create Trigger** button, then click on the **Existing Lambda function** from the dropdown list.
    - From the *Function* dropdown list, choose the Lambda function you have created on Step 5.
    - Leave the *Batch size* value as it is by default, which is normally ***100***.
    - Check the *Enable trigger*.
    - Click on **Create** to finish.

The installation steps section ends at this point, but the AWS CloudWatch and GuardDuty services need some additional configuration to work with the Lambda function together.

## Set up CloudWatch
> In this section, a CloudWatch event rule will be created to invoke the Lambda function based on events happening in GuardDuty findings.
> If you have not subscribed to GuardDuty yet, you need to subscribe to it before moving on. More information about GuardDuty please see [Amazon GuardDuty](https://aws.amazon.com/guardduty/getting-started/).

1. Create a new event rule.
    - For Event Source, choose **Event Pattern**, and select **Events by Service** from the dropdown list.
    - For Service Name, select **GuardDuty** from the dropdown list.
    - For Event Type, select **GuardDuty Finding** from the dropdown list.
    - Check that the **Event Pattern Preview** looks like the code snippet below.
    - For the targets, click on **Add Target\*** and select **Lambda function** from the dropdown list.
    - For the Function, select *the Lambda function you created* from the dropdown list.
    - Click on **Configure rule details** button to move on to the second step.
    - Name the rule as you wish.(e.g. ***aws-lambda-guardduty-finding-event-rule***)
    - For State, check the **Enabled** checkbox.
    - Click on **Create Rule** to finish.

Event Pattern Preview code snippet:
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
## Test
### Simple test from Lambda function
> When all services have been created and configured properly, here is a simple test to verify your work.
1. Create and run the test event from the Lambda function.
    - From the *Test Event* dromdown list, choose *Configure test events*.
    - Select *Create new test event* to add a test event with the content as the code snippet below.
    - From the *Test Event* dropdown list again, choose the event you have just created, click on the *Test* button to execute this Lambda function with the given event.
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
2. Verify the test result.
    - You will see **Execution result: succeeded** on the top of the page of this Lambda function if you set everything up correctly.
    - Check and see a record with *finding_id* - ***fa9fa4a5-0232-188d-da1c-af410bcfc344*** and *ip* - ***192.168.123.123*** is in the DynamoDB table - ***my-aws-lambda-guardduty-db***.
    - Check and see the file **ip_blocklist** resides in the S3 bucket ***my-aws-lambda-guardduty***.
    - Check that the **ip_blocklist** file has a *Read object* permission for *Everyone* under the *Public access* section.
    - Check that the **ip_blocklist** is accessible through its link in browser (e.g. https://s3-us-east-1.amazonaws.com/***my-aws-lambda-guardduty***/ip_blocklist)
    - Check that the **ip_blocklist** file contains **192.168.123.123** in a single line in its content.

## Generate Sample Findings in GuardDuty (Optional)
> Amazon GuardDuty monitors your AWS infrastructures on a continuous basis to detect malicious or unauthorized behavior  and creates records based on such findings.
> If you have just subscribed to GuardDuty for the first time, you will see no *Findings* in the list. You can click **Generate sample findings** under Settings and get some samples. Then several dummy findings marked as “[SAMPLE]” will be created.
> As long as you have set up the Lambda function and CloudWatch correctly, some of those *sample findings* will trigger the CloudWatch event rule to run the Lambda function. A few new IP addresses will eventually appear in the **ip_blocklist**.

## Setup the FortiGate(s)
> Instructions can be found in the FortiGate documentation in GuardDuty integration section.

## Cleanup
> Since test events and sample findings can update the **ip_blocklist** with sample IP addresses, it is highly recommended to clean up the **ip_blocklist**  for production use.
> Note this clean up step will remove the **ip_blocklist** from the S3 bucket and clear the DynamoDB table.
1. Delete all records from the DynamoDB table. i.e. ***my-aws-lambda-guardduty-db***.
2. Delete the ***ip_blocklist*** file in the ***my-aws-lambda-guardduty*** bucket.

# Related Documentation

# Support
Note Fortinet-provided Lambda scripts are not supported within regular Fortinet technical support scope.
For direct issues, please refer to the [Issues](https://github.com/fortinet/aws-lambda-guardduty/issues) tab of this GitHub project.
For other questions related to the Lambda scripts, contact [github@fortinet.com](mailto:github@fortinet.com).

## License
[License](https://github.com/fortinet/aws-lambda-guardduty/blob/master/README) © Fortinet Technologies. All rights reserved.