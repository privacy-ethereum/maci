const mongodb = require('mongodb')
const to = require('await-to-js').default
const logger = require('./logger').logger
const MongoClient = require('mongodb').MongoClient;

const dbName = 'poll'
const collectionName = 'contracts_v1'
const uri = process.env.mongo_uri

if (!uri) {
  logger.error('mongo_uri is not defined')
  process.exit(1)
}

async function initConnection() {
  let [err, dbClient] = await to(MongoClient.connect(uri))
  if (err) {
    logger.error(`cannot connect to mongodb with uri: ${uri}`)
    return false
  }
  return dbClient
}

async function ping(dbClient) {
  if (!dbClient) {
     logger.error('db is not initialized')
     return false
  }
  let res = await dbClient.db('admin').command({ping: 1})
  logger.info(`pong: ${JSON.stringify(res)}`)
  return true
}

// below are cli options for admin
async function updateRecord(data) {
  let client = await MongoClient.connect(uri)
  let query = { 'MACI': data['MACI'] }
  await client.db(dbName).collection(collectionName).updateOne(query, {$set: data}, {upsert: true})
  logger.info('record updated')
  client.close()
}

async function removeRecord(maciAddr) {
  let client = await MongoClient.connect(uri)
  let query = { 'MACI': maciAddr };
  await client.db(dbName).collection(collectionName).deleteOne(query)
  logger.info(`record deleted for maci addr ${maciAddr}`)
  client.close()
}

async function queryRecord(maciAddr) {
  let client = await MongoClient.connect(uri)
  let query = { 'MACI': maciAddr };
  let res = await client.db(dbName).collection(collectionName).findOne(query)
  logger.info(`record for maci addr ${maciAddr} is: ${JSON.stringify(res)}`)
  client.close()
}

module.exports = {
    dbName,
    collectionName,
    initConnection,
    ping,
    updateRecord,
    removeRecord,
    queryRecord,
}
