# Bea Utilities scripts

## Simple utilities scripts to do common and repeated tasks related to bea platform

---

<br/>
Firstly, before trying to execute one the scripts you must add the .env file which should contains:

- BASE_URL: the endpoint of the appSearch instance
- API_KEY: the API key for the appSearch instance ([see how appSearch work](https://www.elastic.co/guide/en/app-search/current/documents.html))
- ENVIRONMENT: this depends on the environment on which you want to execute a given script (values: dev or prod)
- ACCESS_KEY_ID: access key id of the bea AWS account
- SECRET_ACCESS_KEY: secret access key of the bea AWS account
- REGION: region in which reside the resources
- BENEFICIARIES_ENGINE: name of the beneficiaries engine
- TRANSACTIONS_ENGINE: name of the transactions engine

# Available scripts

For now, this code offer two utilities task, which are:

## Sync Appsearch with DynamoDB

Syncing Dynamodb `bps_local` table with appSearch engines.

The process of executing the script is partially manual:

- Backup and store `bps_local` data in S3, for instruction on performing this action [see AWS documentation]().
- Download the data from S3.
- Place the downloaded files in the `backup/{env}/bps_local` location, depending on the environment you which to sync. `env = dev or prod`.
- Changing the structure of the files: by default the downloaded files will contains items in form of objects you need to transform the data of each file into an array of objects.
- Now execute the script located in `sync_dynamodb_with_appsearch/index.js`: this will take data from files, format them and insert them into the appSearch engines.

Sometimes you may need to only sync transactions or beneficiaries data with appSearch for that you need to change the code and comment the undesired engine.

------
## Update transactions

Updating transactions attributes in `bps_local` dynamodb table.

The process of executing the script:

- put the csv file that contains the updated data in the `update_transactions` folder and renaming it `results.csv`
- navigate to `update_transactions/index.js` file and change how the `update` method is called, by including the attributes that you want to change, the updated values of those attributes will be fetched from the csv file.

Wish for you a happy scripting 😄.
