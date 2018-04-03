Vue.use(VueTippy)
Vue.use(VueMarkdown)
Vue.config.devtools = true;
Vue.component('burnbox-component', {
  template: `
  <div>
    <p> Burn Amount(ETH) </p>
    <input type="number" step ="any" placeholder="Burn Amount(ETH)" id="message-input" v-bind:value="value" v-on:input="updateValue($event.target.value)">
    <input class="yellow-button" type="submit" v-on:click="$emit('btnclick')" value="Submit">
  </div>`,
  props: ['value'],
  methods: {
    updateValue: function (value) {
      this.$emit('input', value);
    }
  }
});
Vue.component('tipbox-component', {
  template: `
  <div>
    <p> Tip Amount(ETH) </p>
    <input type="number" step ="any" placeholder="Tip Amount(ETH)" id="message-input" v-bind:value="value" v-on:input="updateValue($event.target.value)">
    <input class="yellow-button" type="submit" v-on:click="$emit('btnclick')" value="Submit">
  </div>`,
  props: ['value'],
  methods: {
    updateValue: function (value) {
      this.$emit('input', value);
    }
  }
});

const vm = new Vue ({
    el: '#vue-instance',
    data () {
      return {
        messages: [],
        notifications: [],
        deposit: "Initial Deposit",
        finalizeInterval: "Finalize Time",
        burnFactor: "Burn Factor",
        initialBurn: "Initial Burn",
        tipAmount: "Tip Amount",
        burnAmount: "Burn Amount",
        activeMessage: 0,
        f_minBurnFactor: 0,
        f_maxBurnFactor: Infinity,
        f_minBalance: 0,
        f_maxBalance: Infinity,
        f_minAge: 0,
        f_maxAge: Infinity,
        f_minBurned: 0,
        f_maxBurned: Infinity,
        f_minInitialBurned: 0,
        f_maxInitialBurned: Infinity,
        f_showActiveOnly: true,
        draft: ''
      }
    },
    computed : {
      eth_minBalance: function(){ return new web3.BigNumber(this.f_minBalance) },
      eth_maxBalance: function(){ return  new web3.BigNumber(this.f_maxBalance) },
      eth_minBurned: function(){ return new web3.BigNumber(this.f_minBurned) },
      eth_maxBurned: function(){ return new web3.BigNumber(this.f_maxBurned) },
      eth_minInitialBurned: function(){ return new web3.BigNumber(this.f_minInitialBurned) },
      eth_maxInitialBurned: function(){ return new web3.BigNumber(this.f_maxInitialBurned) },
      filteredMessages: function(){ 
        return this.messages
        .filter(this.checkBalance)
        .filter(this.checkBurned)
        .filter(this.checkBurnFactor)
        .filter(this.checkAge)
        .filter(this.checkActive) 
      }
      
    },
    async created () {
      this.addNotification('Welcome to Burnchat!');

      if (typeof web3 !== 'undefined') {
        this.web3js = new Web3(web3.currentProvider);
      } else {
        this.addNotification('No web3? You should consider trying MetaMask!');
        this.web3js = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
      }

      this.isUnlocked();

      this.burnChatAPI = new BurnChatAPI("0x3ce3f3c6e086ff6741bde9db8f0a4407ec30ae3d", this.web3js, this.notify);
      this.messages = await this.burnChatAPI.loadHistory();
      console.log(this.messages)
    },
    methods: {

      checkBurnFactor(m) {
        return (this.f_minBurnFactor <= m.burnFactor && m.burnFactor <= this.f_maxBurnFactor);
      },

      checkBalance(m) {
        return (this.eth_minBalance.lessThanOrEqualTo(m.balance) && m.balance.lessThanOrEqualTo(this.eth_maxBalance));
      },

      checkBurned(m) {
        return (this.eth_minBurned.lessThanOrEqualTo(m.burnedByOthers) && m.burnedByOthers.lessThanOrEqualTo(this.eth_maxBurned));
      },
      
      checkAge(m) {
        return (this.f_minAge <= m.postTime && m.postTime <= this.f_maxAge);
      },

      checkActive(m) {
        if(this.f_showActiveOnly){
          return m.state === "active" ?  true : false;
        }
        return true;
      },



      async sendMessage () {

        if(!this.isUnlocked()){
            return;
        }
        if (!this.draft || this.draft === '') {
            this.addNotification("ERROR: Message field is blank");
            return;
         }
        if (!this.deposit || this.deposit === "Initial Deposit") { 
            this.addNotification("ERROR: Intial Deposit field is blank");
            return;
        }
        if (!this.finalizeInterval || this.finalizeInterval === "Finalize Time") { 
            this.addNotification("ERROR: Finalize Interval field is blank");
            return; 
        }
        if (!this.burnFactor || this.burnFactor === "Burn Factor") { 
            this.addNotification("ERROR: Burn Factor field is blank");
            return; 
        }
        if (!this.initialBurn || this.initialBurn === "Initial Burn") { 
            this.addNotification("ERROR: Initial Burn field is blank");
            return;
        }
        if (this.deposit < this.initialBurn) { 
          this.addNotification("ERROR: Deposit must be greater than inital burn");
          return;
        }

        const value = this.web3js.toWei(this.deposit, 'ether');
        const burn = this.web3js.toWei(this.initialBurn, 'ether');
        const time = new this.web3js.BigNumber(this.finalizeInterval * 3600);
        const factor = new this.web3js.BigNumber(this.burnFactor);

        const res = await this.burnChatAPI.postMessage(this.draft, value, burn, time, factor)
        .catch((err) => {
            this.addNotification(err.message);
            return;
        });

        this.addNotification(`TxHash: ${res}`);
      },

      async finalizeMessage(messageID){
        const res = await this.burnChatAPI.finalizeMessage(messageID)
        .catch((err) => {
          this.addNotification(err.message);
          return;
        })

        this.addNotification(`TxHash: ${res}`);
      },

      async burnMessage(){
        const value = this.web3js.toWei(this.burnAmount, 'ether');
        const res = await this.burnChatAPI.burnMessage(this.activeMessage, value)
        .catch((err) => {
          this.addNotification(err.message);
          return;
        });

        this.addNotification(`TxHash: ${res}`);
      },

      async tipMessage(){
        const value = this.web3js.toWei(this.tipAmount, 'ether');
        const res = await this.burnChatAPI.tipMessage(this.activeMessage, value)
        .catch((err) => {
          this.addNotification(err.message);
          return;
        });

        this.addNotification(`TxHash: ${res}`);
      },

      async notify(event){
       this.messages = await this.burnChatAPI.loadHistory();
      },

      isUnlocked(){
        if (!this.web3js.eth.defaultAccount) {
            this.addNotification("No account detected, is metamask unlocked?")
            return false;
        }
        return true;
      },

      etherscanBaseUrl () {
        let url;
        switch(this.web3js.version.network){
            case '1':
              url = 'https://etherscan.io/';
              break;
            case '3':
              url = 'https://ropsten.etherscan.io/';
              break;
            case '4':
              url = 'https://rinkeby.etherscan.io/';
              break;
            case '42':
              url = 'https://kovan.etherscan.io/';
              break;
            default:
              url = 'https://etherscan.io/';
              break;
        }
        return url;
      },

      setActiveMessage (id){
        this.activeMessage = id;
      },
  
      addMessage (message) {
        this.messages.push(message)
        this.autoscroll(this.$refs.chatContainer)
      },
  
      addNotification (message) {
        const timestamp = new Date().toLocaleTimeString()
        this.notifications.push({ message, timestamp })
        this.autoscroll(this.$refs.notificationContainer)
      },
  
      autoscroll (element) {
        if (element) { element.scrollTop = element.scrollHeight }
      }
    }
  })