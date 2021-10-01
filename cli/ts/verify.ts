import * as fs from 'fs'

import { genTallyResultCommitment, genTallyResultSubtotalCommitment } from 'maci-core'
import { hash2, hash3 } from 'maci-crypto'

import {
    parseArtifact,
    getDefaultSigner,
} from 'maci-contracts'

import {
    calcQuinTreeDepthFromMaxLeaves,
    validateEthAddress,
    contractExists,
} from './utils'

import * as ethers from 'ethers'

const Web3 = require('web3')

const configureSubparser = (subparsers: any) => {
    const parser = subparsers.addParser(
        'verify',
        { addHelp: true },
    )
    parser.addArgument(
        ['-t', '--tally-file'],
        {
            required: true,
            type: 'string',
            help: 'A filepath in which to save the final vote tally and salt.',
        }
    )

    parser.addArgument(
        ['-x', '--contract'],
        {
            required: true,
            type: 'string',
            help: 'The MACI contract address',
        }
    )

    parser.addArgument(
        ['-o', '--poll-id'],
        {
            action: 'store',
            required: true,
            type: 'string',
            help: 'The Poll ID',
        }
    )

    parser.addArgument(
        ['-q', '--ppt'],
        {
            required: true,
            type: 'string',
            help: 'The PollProcessorAndTallyer contract address',
        }
    )
}

const verify = async (args: any) => {
    const signer = await getDefaultSigner()

    if (!validateEthAddress(args.ppt)) {
        console.error('Error: invalid PollProcessorAndTallyer contract address')
        return 1
    }

    const [ maciContractAbi ] = parseArtifact('MACI')
    const [ pollContractAbi ] = parseArtifact('Poll')
    const [ pptContractAbi ] = parseArtifact('PollProcessorAndTallyer')

    const pptAddress = args.ppt
    if (! (await contractExists(signer.provider, pptAddress))) {
        console.error(`Error: there is no contract deployed at ${pptAddress}.`)
        return 1
    }

    const maciAddress = args.contract
    const pollId = Number(args.poll_id)

	const maciContract = new ethers.Contract(
        maciAddress,
        maciContractAbi,
        signer,
    )

    const pollAddr = await maciContract.polls(pollId)
    if (! (await contractExists(signer.provider, pollAddr))) {
        console.error('Error: there is no Poll contract with this poll ID linked to the specified MACI contract.')
        return 1
    }

    const pollContract = new ethers.Contract(
        pollAddr,
        pollContractAbi,
        signer,
    )

    const pptContract = new ethers.Contract(
        pptAddress,
        pptContractAbi,
        signer,
    )

    const onChainTallyCommitment = BigInt(await pptContract.tallyCommitment())
    console.log(onChainTallyCommitment.toString(16))

    // Read the tally file
    let contents
    try {
        contents = fs.readFileSync(args.tally_file, { encoding: 'utf8' })
    } catch {
        console.error('Error: unable to open ', args.tally_file)
        return
    }

    // Parse the tally file
    let data
    try {
        data = JSON.parse(contents)
    } catch {
        console.error('Error: unable to parse ', args.tally_file)
        return
    }

    // Check the results commitment
    const validResultsCommitment =
        data.newTallyCommitment &&
        data.newTallyCommitment.match(/0x[a-fA-F0-9]+/)

    if (!validResultsCommitment) {
        console.error('Error: invalid results commitment format')
        return
    }

    // Ensure that the lengths of data.results.tally and
    // data.perVOSpentVoiceCredits.tally are correct
    // Get vote option tree depth
    const treeDepths = await pollContract.treeDepths()
    const voteOptionTreeDepth = Number(treeDepths.voteOptionTreeDepth)
    const numVoteOptions = 5 ** voteOptionTreeDepth
    const wrongNumVoteOptions = 'Error: wrong number of vote options.'
    if (data.results.tally.length !== numVoteOptions) {
        console.error(wrongNumVoteOptions)
        return 1
    }

    if (data.perVOSpentVoiceCredits.tally.length !== numVoteOptions) {
        console.error(wrongNumVoteOptions)
        return 1
    }

    // Verify that the results commitment matches the output of
    // genTallyResultCommitment()

    // Verify the results

    // Compute newResultsCommitment
    const newResultsCommitment = genTallyResultCommitment(
        data.results.tally.map((x) => [ BigInt(x[0]), BigInt(x[1]) ]),
        data.results.salt,
        voteOptionTreeDepth
    )

    // Compute newSpentVoiceCreditsCommitment
    const newSpentVoiceCreditsCommitment = hash2([
        BigInt(data.totalSpentVoiceCredits.spent),
        BigInt(data.totalSpentVoiceCredits.salt),
    ])

    // Compute newPerVOSpentVoiceCreditsCommitment
    const newPerVOSpentVoiceCreditsCommitment = genTallyResultSubtotalCommitment(
        data.perVOSpentVoiceCredits.tally.map((x) => BigInt(x)),
        data.perVOSpentVoiceCredits.salt,
        voteOptionTreeDepth
    )

    // Compute newTallyCommitment
    const newTallyCommitment = hash3([
        newResultsCommitment,
        newSpentVoiceCreditsCommitment,
        newPerVOSpentVoiceCreditsCommitment,
    ])

    if (onChainTallyCommitment !== newTallyCommitment) {
        console.log('Error: the on-chain tally commitment does not match.')
        return 1
    }

    console.log('OK')

    return 0
}

export {
    verify,
    configureSubparser,
}
