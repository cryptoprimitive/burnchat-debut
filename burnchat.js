
const ContractABI = [{"constant":true,"inputs":[{"name":"","type":"uint256"}],"name":"activeMessages","outputs":[{"name":"from","type":"address"},{"name":"balance","type":"uint256"},{"name":"burnFactor","type":"uint256"},{"name":"finalizeTime","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"anonymous":false,"inputs":[{"indexed":false,"name":"messageID","type":"uint256"},{"indexed":false,"name":"burner","type":"address"},{"indexed":false,"name":"initiatingBurn","type":"uint256"},{"indexed":false,"name":"resultingBurn","type":"uint256"}],"name":"MessageBurned","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"messageID","type":"uint256"},{"indexed":false,"name":"amountReturned","type":"uint256"}],"name":"MessageFinalized","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"messageID","type":"uint256"}],"name":"MessageSmoked","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"messageID","type":"uint256"},{"indexed":false,"name":"tipper","type":"address"},{"indexed":false,"name":"amount","type":"uint256"}],"name":"MessageTipped","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"messageID","type":"uint256"},{"indexed":false,"name":"from","type":"address"},{"indexed":false,"name":"message","type":"string"},{"indexed":false,"name":"amountBurned","type":"uint256"},{"indexed":false,"name":"amountDeposited","type":"uint256"},{"indexed":false,"name":"finalizeTime","type":"uint256"},{"indexed":false,"name":"burnFactor","type":"uint256"}],"name":"NewMessage","type":"event"},{"constant":false,"inputs":[{"name":"messageID","type":"uint256"}],"name":"burnMessage","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[{"name":"messageID","type":"uint256"}],"name":"finalizeMessage","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"message","type":"string"},{"name":"initialBurn","type":"uint256"},{"name":"finalizeInterval","type":"uint256"},{"name":"burnFactor","type":"uint256"}],"name":"post","outputs":[{"name":"","type":"uint256"}],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[{"name":"messageID","type":"uint256"}],"name":"tipMessage","outputs":[],"payable":true,"stateMutability":"payable","type":"function"}];

 class BurnChatAPI {
    constructor(address, web3){
        this.web3 = web3;
        this.contractAddress = address;
        this.burnChatManager = {
            ABI : ContractABI
        }
        this.burnChatManager.contract = this.web3.eth.contract(ContractABI);
        this.burnChatManager.contractInstance = this.burnChatManager.contract.at(address);
    }

    async loadHistory(fromBlock = 0){
        let messages = [];
        const events = await this.getAllEvents(fromBlock);
        events.sort((a,b) => { return a.blockNumber - b.blockNumber });
        for(let e of events) {
            let i = messages.findIndex(el => el.messageID === e.args.messageID.toNumber());
            switch(e.event){
                case "NewMessage" : {
                    let m = {};
                    m.message = e.args.message;
                    m.messageID = e.args.messageID.toNumber();
                    m.from = e.args.from;
                    m.balance = e.args.amountDeposited;
                    m.burnFactor = e.args.burnFactor.dividedBy(1000).toNumber();
                    m.finalizeTime = e.args.finalizeTime.toNumber();
                    m.postTime = await this.getBlockTimeStamp(e.blockHash);
                    m.initialDeposit = e.args.amountDeposited;
                    m.intialBurn = e.args.amountBurned;
                    m.burnedByOthers = new web3.BigNumber(0);
                    m.totalTipped = new web3.BigNumber(0);
                    m.state = e.args.amountDeposited.toNumber() == 0 ? "smoked" : "active";
                    messages.push(m);
                    break;
                }
                case "MessageTipped" : {
                    messages[i].balance = messages[i].balance.plus(e.args.amount);
                    messages[i].totalTipped = messages[i].totalTipped.plus(e.args.amount);
                    break;
                }
                case "MessageBurned" : {
                    messages[i].balance = messages[i].balance.minus(e.args.resultingBurn);
                    messages[i].burnedByOthers = messages[i].burnedByOthers.plus(e.args.resultingBurn);
                    break;
                }
                case "MessageSmoked" : {
                    try{
                    messages[i].state = "smoked";
                    } catch (e) {}
                    break;
                }
                case "MessageFinalized" : {
                    messages[i].state = "finalized";
                    messages[i].balance = new web3.BigNumber(0);
                    break;
                }
            }
        }
        return messages;
    }


    finalizeMessage(messageID){
        return new Promise((resolve, reject) =>{
            this.burnChatManager.contractInstance.finalizeMessage.sendTransaction(messageID, {gas: 100000}, (err, res) => {
                    if(err){
                        reject(err);
                    }
                    if(res){
                        resolve(res);
                    }
                });
        })
    }

    burnMessage(messageID, amount){
        return new Promise((resolve, reject) =>{
            this.burnChatManager.contractInstance.burnMessage.sendTransaction(messageID, {value: amount, gas: 100000}, (err, res) => {
                    if(err){
                        reject(err);
                    }
                    if(res){
                        resolve(res);
                    }
                });
        })
    }

    tipMessage(messageID, amount){
        return new Promise((resolve, reject) =>{
            this.burnChatManager.contractInstance.tipMessage.sendTransaction(messageID, {value: amount, gas: 100000}, (err, res) => {
                    if(err){
                        reject(err);
                    }
                    if(res){
                        resolve(res);
                    }
                });
        })
    }

    postMessage(message, value, initialBurn, finalizeInterval, burnFactor){
        return new Promise((resolve, reject) =>{
            this.burnChatManager.contractInstance.post.sendTransaction(message, initialBurn, finalizeInterval, burnFactor, {value: value, gas: 1000000}, (err, res) => {
                    if(err){
                        reject(err);
                    }
                    if(res){
                        resolve(res);
                    }
                });
        })
    }

    getBlockTimeStamp(blockHash){
        return new Promise((resolve, reject) => {
            this.web3.eth.getBlock(blockHash, false, (err, res) => {
                if(err){
                    reject(err);
                }
                if(res){
                    resolve(res.timestamp);
                }
            })
        })
    }

    getAllEvents(fromBlock) {
        return new Promise((resolve, reject) =>{
            this.burnChatManager.contractInstance.allEvents( {fromBlock: fromBlock}).get((err, res) => {
                if(err){
                    reject(err);
                }
                if(res){
                    resolve(res);
                    console.log(res);
                }
            });
        })
    }
}


