const { expect } = require('chai');
const { ethers } = require('hardhat');

const tokens = (n) => {
    return ethers.utils.parseUnits(n.toString(), 'ether')
}

describe('Escrow', () => {
    let buyer, seller, inspector, lender
    let realEstate, escrow

    //run these before each tests inside describe block;
    beforeEach(async () => {
        //setup accounts;
        [buyer, seller, inspector, lender] = await ethers.getSigners()

        //deploy realestate contract;
        const RealEstate = await ethers.getContractFactory('RealEstate')
        realEstate = await RealEstate.deploy()

        //mint nft, basically property pictures in this case;
        let transaction = await realEstate.connect(seller).mint("https://ipfs.io/ipfs/QmTudSYeM7mz3PkYEWXWqPjomRPHogcMFSq7XAvsvsgAPS")
        await transaction.wait()

        //deploy the escrow contract 
        const Escrow = await ethers.getContractFactory('Escrow')
        escrow = await Escrow.deploy(
            realEstate.address,
            seller.address,
            inspector.address,
            lender.address
        )

        //approve the property;
        transaction = await realEstate.connect(seller).approve(escrow.address,1)
        await transaction.wait()

        //list property
        transaction = await escrow.connect(seller).list(1, buyer.address, tokens(10), tokens(5))
        await transaction.wait()
    })


    //deployment section check for each address;
    describe('Deployment', () => {
        it('Returns NFT address', async () => {
            const result = await escrow.nftAddress()
            expect(result).to.be.equal(realEstate.address)
        })

        it('Returns seller', async () => {
            const result = await escrow.seller()
            expect(result).to.be.equal(seller.address)
        })

        it('Returns inspector', async () => {
            const result = await escrow.inspector()
            expect(result).to.be.equal(inspector.address)
        })

        it('Returns lender', async () => {
            const result = await escrow.lender()
            expect(result).to.be.equal(lender.address)
        })
    })

    //listing 
    describe('Listing', () => {
        it('Updates as listed', async () => {
            const result = await escrow.isListed(1)
            expect(result).to.be.equal(true)
        })

        it('Updates the ownership', async () => {
            expect(await realEstate.ownerOf(1)).to.be.equal(escrow.address)
        })

        it('Returns buyer', async () => {
            const result = await escrow.buyer(1)
            expect(result).to.be.equal(buyer.address)
        })

        it('Returns purchase price', async () => {
            const result = await escrow.purchasePrice(1)
            expect(result).to.be.equal(tokens(10))
        })

        it('Returns escrow amount', async () => {
            const result = await escrow.escrowAmount(1)
            expect(result).to.be.equal(tokens(5))
        })

        // //test to assure that only the owner aka the seller can call the list function
        // it('Check only owner can call the list function', async() => {
        //     //get the address of owner
        //     const owner = await escrow.seller()

        //     //revert any attempt to call list apart from seller address;
        //     const{buyer} = await ethers.getSigners();
        //     await expect (
        //         escrow.connect(buyer).list(2, buyer.address, tokens(10), tokens(5))
        //     ).to.be.revertedWith('Ownable: caller of the function must be seller')

        //     //ensure the seller to be able to call list;
        //     const result = await escrow.list(2, buyer.address, tokens(10), tokens(5))
        //     expect(result).to.be.an('object')
        // })

    })

    //deposits from buyer side;
    describe('Deposit', () => {
        it('Updates contract balance', async () => {
            const transaction= await escrow.connect(buyer).downPayment(1, {value: tokens(5)})
            await transaction.wait()
            const result = await escrow.getBalance();
            expect(result).to.be.equal(tokens(5))
        })
    })

    //inspections;
    describe('Inspection', () => {
        it('Updates contract inspection status', async () => {
            const transaction = await escrow.connect(inspector).updateInspectionStatus(1,true)
            await transaction.wait()
            const result = await escrow.inspectionPassed(1)
            expect(result).to.be.equal(true)
        })
    })

    //approval
    describe('Approval', () => {
        it('Updates contract approval status', async () => {
            let transaction = await escrow.connect(buyer).approveSale(1)
            await transaction.wait()

            let transactionSeller = await escrow.connect(seller).approveSale(1)
            await transactionSeller.wait()

            let transactionLender = await escrow.connect(lender).approveSale(1)
            await transactionLender.wait()

            expect(await escrow.approval(1, buyer.address)).to.be.equal(true)
            expect(await escrow.approval(1, seller.address)).to.be.equal(true)
            expect(await escrow.approval(1, lender.address)).to.be.equal(true)
        })
    })

    //finalize sale;
    describe('Sale', () => {
        beforeEach(async() => {
            let transaction= await escrow.connect(buyer).downPayment(1, {value: tokens(5)})
            await transaction.wait()

            transaction = await escrow.connect(inspector).updateInspectionStatus(1,true)
            await transaction.wait()

            transaction = await escrow.connect(buyer).approveSale(1)
            await transaction.wait()

            transaction = await escrow.connect(seller).approveSale(1)
            await transaction.wait()

            transaction = await escrow.connect(lender).approveSale(1)
            await transaction.wait()

            await lender.sendTransaction({to: escrow.address, value: tokens(5)})

            transaction = await escrow.connect(seller).finalizeSale(1)
            await transaction.wait()
        })

        it('Updates Ownershup to buyer after bought', async() => {
            expect(await realEstate.ownerOf(1)).to.be.equal(buyer.address)
        })

        it('Updates balance to zero after sending', async () => {
            expect(await escrow.getBalance()).to.be.equal(0)
        })
    })

})
