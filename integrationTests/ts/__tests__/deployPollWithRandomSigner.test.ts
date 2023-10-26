jest.setTimeout(3000000)

import {
    loadData,
    execute,
    executeSuite,
} from './suites'

import { loadYaml } from './utils'
import * as fs from 'fs'
import * as path from 'path'
import { Keypair } from 'maci-domainobjs'
import { BigNumber, providers, Contract, Wallet, utils } from 'ethers'

const maciAbi = ["function getPoll(uint256 _pollId) public view returns (address)"]
const pollAbi = ["function getDeployTimeAndDuration() public view returns (uint256, uint256) "]


async function getPollDuration(providerUrl: string, maci: string, pollId: number): Promise<BigNumber> {
    const provider = new providers.JsonRpcProvider(providerUrl)
    const maciContract = new Contract(maci, maciAbi, provider)
    const pollAddress = await maciContract.getPoll(pollId)
    const pollContract = new Contract(pollAddress, pollAbi, provider)
    const [_, duration] = await pollContract.getDeployTimeAndDuration()
    return duration
}

describe('Test deployPollWithSigner', () => {
    const data = loadData('suites.json')
    const test = data.suites[0]
    it(test.description, async () => {
        const result = await executeSuite(test, expect)
        console.log(result)
        expect(result).toBeTruthy()


	let caughtException = false
	try {
            const config = loadYaml()

	    const tally = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../cli/tally.json')).toString())
	    const coordinatorKeypair = new Keypair()

	    // start another round by a random user
	    const wallet = Wallet.createRandom()

	    // fund wallet with 1 ETH
	    const totalAmount = utils.parseEther("1")
            const fundWalletCommand = `node build/index.js fundWallet` +
            ` -w ${wallet.address}` +
            ` -a ${totalAmount.toString()}`
	    execute(fundWalletCommand)
	    
	    const duration = 999999
            const deployPollCommand = `node build/index.js deployPollWithSigner` +
            ` -x ${tally.maci}` +
            ` -s ${wallet.privateKey}` +
            ` -pk ${coordinatorKeypair.pubKey.serialize()}` +
            ` -t ${duration}` +
            ` -g ${config.constants.maci.maxMessages}` +
            ` -mv ${config.constants.maci.maxVoteOptions}` +
            ` -i ${config.constants.poll.intStateTreeDepth}` +
            ` -m ${config.constants.poll.messageTreeDepth}` +
            ` -b ${config.constants.poll.messageBatchDepth}` +
            ` -v ${config.constants.maci.voteOptionTreeDepth}`
	    execute(deployPollCommand)

	    // this is the second poll with pollId = 1
	    const pollId = 1
	    const pollDuration = await getPollDuration(tally.provider, tally.maci, pollId)
	    expect(pollDuration.toString()).toEqual(duration.toString())
	    
	} catch (e) {
	    console.log(e)
	    caughtException = true
	    expect(caughtException).toEqual(false)
	}
    })
})
