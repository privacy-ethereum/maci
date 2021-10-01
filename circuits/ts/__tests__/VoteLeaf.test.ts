jest.setTimeout(90000)

import {
    genWitness,
    getSignalByName,
} from './utils'

import {
    VoteLeaf
} from 'maci-domainobjs'

describe('VoteLeaf circuit', () => {
  const valid_circuit = 'voteLeaf_test'
  const calc_circuit = 'voteLeafSquared_test'
  const pack_circuit = 'voteLeafPack_test'

    it('Valid vote leaf', async() => {
      const [ pos, neg ] = [ 4, 3 ]
      const voteLeaf = new VoteLeaf(BigInt(pos), BigInt(neg))
      const packedLeaf = voteLeaf.pack().toString()

      const witness = await genWitness(valid_circuit, { packedLeaf })

      const out = await getSignalByName(valid_circuit, witness, `main.out`)
      const actual_pos = await getSignalByName(valid_circuit, witness, `main.pos`)
      const actual_neg = await getSignalByName(valid_circuit, witness, `main.neg`)

      expect(actual_pos).toEqual(pos.toString())
      expect(actual_neg).toEqual(neg.toString())
      expect(out).toEqual('1')
    })

    it('Invalid vote leaf', async() => {
      const packedLeaf = BigInt(Math.pow(2, 50)).toString()

      const witness = await genWitness(valid_circuit, { packedLeaf })
      const out = await getSignalByName(valid_circuit, witness, `main.out`)

      expect(out).toEqual('0')
    })

    it('Valid packed 100 bit leaf', async() => {
      const bitsPerVal = BigInt(50)
      const [ pos, neg ] = [ BigInt(9), BigInt(0) ]
      const packed50BitLeaf = ((pos << bitsPerVal) + neg).toString()

      const witness = await genWitness(pack_circuit, { in: [ `${pos}`, `${neg}` ] })
      const out = await getSignalByName(pack_circuit, witness, `main.packedLeaf`)

      expect(out).toEqual(packed50BitLeaf)
    })

    it('Valid squared calc', async() => {
      const [ pos, neg ] = [ 4, 3 ]
      const voteLeaf = new VoteLeaf(BigInt(pos), BigInt(neg))
      const packedLeaf = voteLeaf.pack().toString()
      const squared = Math.pow((pos + neg), 2)

      const witness = await genWitness(calc_circuit, { packedLeaf })
      const actual_squared = await getSignalByName(calc_circuit, witness, `main.out`)
      const actual_pos = Math.sqrt(actual_squared) - neg
      const actual_neg = Math.sqrt(actual_squared) - pos

      expect(actual_squared).toEqual(squared.toString())
      expect(actual_pos).toEqual(pos)
      expect(actual_neg).toEqual(neg)
    })

    it('Zero valued squared calc', async() => {
      const voteLeaf = new VoteLeaf(BigInt(0), BigInt(0))
      const packedLeaf = voteLeaf.pack().toString()

      const witness = await genWitness(calc_circuit, { packedLeaf })
      const out = await getSignalByName(calc_circuit, witness, `main.out`)

      expect(out).toEqual('0')
    })

})
