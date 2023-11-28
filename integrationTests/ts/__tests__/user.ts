import { Keypair, PrivKey } from "maci-domainobjs";

export interface Vote {
    voteOptionIndex: number;
    voteWeight: number;
    nonce: number;
    valid: boolean;
}

export class UserCommand {
    public keypair: Keypair;
    public votes: Vote[];
    public voiceCreditBalance: bigint;
    public nonce: bigint;

    constructor(
        _keypair: Keypair,
        _votes: Vote[],
        _voiceCreditBalance: bigint,
        _nonce: bigint
    ) {
        this.keypair = _keypair;
        this.votes = _votes;
        this.voiceCreditBalance = _voiceCreditBalance;
        this.nonce = _nonce;
    }

    public changeKeypair(): PrivKey {
        const newUserKeypair = new Keypair();
        const oldPrivateKey = this.keypair.privKey;
        this.keypair = !newUserKeypair.equals(this.keypair)
            ? newUserKeypair
            : this.keypair;
        return oldPrivateKey;
    }

    // public static genBlankUser
    //
    // public static changeUserPubKey
}
