// @flow
import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import * as WalletActions from '../actions/wallet'
import NameInput from '../components/NameInput'
import SignaturesView from '../components/Signatures'
import PubKeysView from '../components/PubKeys'
import CompleteView from '../components/Complete'
import PageWrapper from '../containers/PageWrapper'
import { remote } from 'electron'

type Props = {};

function mapStateToProps(state) {
  return {
  	name: state.wallet.name,
    address: state.wallet.address,
    publicKey: state.wallet.publicKey,
    payload: state.wallet.payload
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(WalletActions, dispatch);
}

const VIEWS = {
  DEFAULT: 0,
  SIGNATURES: 1,
  PUBKEYS: 2,
  COMPLETE: 3,
}

class MultiSigWalletPage extends Component<Props> {
  props: Props;

  constructor(props) {
    super(props)

    this.state = {
      view: VIEWS.DEFAULT,
      name: '',
      signaturesRequired: '',
      publicKeys: ['', ''],
      publicKeyErrors: ['', ''],
      nameError: '',
      signaturesRequiredError: '',
      error: '',
    }
  }

  handleNameChange = (event) => {
    this.setState({
      name: event.target.value
    })
  }

  handlePubKeyChange = (event, index) => {
    var newPublicKeys = this.state.publicKeys
    newPublicKeys[index] = event.target.value
    this.setState({
      publicKeys: newPublicKeys
    })
  }

  handleSignaturesRequiredChange = (event) => {
    if(this.isInt(event.target.value)) {
      var signaturesRequired = parseInt(event.target.value)
      var publicKeys = []
      var publicKeyErrors = []
      for (var x=0; x < signaturesRequired; x++) {
        publicKeys.push('')
        publicKeyErrors.push('')
      }
      this.setState({
        signaturesRequired: parseInt(event.target.value),
        publicKeys,
        publicKeyErrors
      })
    } else if (event.target.value == '') {
      this.setState({
        signaturesRequired: ''
      })
    }
  }

  isInt = (value) => {
    return !isNaN(value) && 
         parseInt(Number(value)) == value && 
         !isNaN(parseInt(value, 10));
  }

  showHSignaturesView = () => {
    const name = this.state.name
    if (name.length === 0) {
      this.setState({
        nameError: 'You must enter a name.'
      })
    } else {
      this.setState({
        nameError: ''
      })
      this.props.updateName(name)
        .then(() => this.changeView(VIEWS.SIGNATURES))
    }
  }

  showPubKeysView = () => {
    const signaturesRequired = this.state.signaturesRequired
    if (signaturesRequired < 2) {
      this.setState({
        signaturesRequiredError: 'Number of signatures required must be greater than 2.'
      })
    } else {
      this.setState({
        signaturesRequiredError: ''
      })
      this.changeView(VIEWS.PUBKEYS)
    }
  }

  addPublicKey = () => {
    var newPublicKeys = this.state.publicKeys
    newPublicKeys.push('')
    this.setState({
      publicKeys: newPublicKeys
    })
  }

  changeView = (view) => {
    this.setState({
      view: view
    })
  }

  verifyPublicKeys = () => {
    var errors = false
    var publicKeys = this.state.publicKeys
    var publicKeyErrors = this.state.publicKeyErrors

    for(var i = 0; i < publicKeys.length; i++) {
      if(publicKeys[i].length == 0) {
        publicKeyErrors[i] = 'Invalid public key'
        errors = true
      } else {
        publicKeyErrors[i] = ''
      }
    }
    this.setState({
      publicKeyErrors
    })
    return !errors
  }

  makeMultiSig = () => {
    if(this.verifyPublicKeys()) {
      this.props.makeMultiSig(this.state.publicKeys, this.state.signaturesRequired)
        .then(({address, payload}) => this.props.generateMultiSigPayload(address, payload))
        .then(() => this.changeView(VIEWS.COMPLETE))
        .catch((error) => {
          this.setState({
            error: 'Failed to generate multi-signature wallet, one or more of your public keys may be invalid.'
          })
        })
    }
  }

  exit = () => {
    this.props.eraseSeed()
    const currentWindow = remote.getCurrentWindow()
    currentWindow.close()
  }

  renderView(view) {
    switch(view) {
      case VIEWS.DEFAULT:
        return <NameInput
                name={this.state.name}
                error={this.state.nameError}
                handleNameChange={this.handleNameChange}
                next={this.showHSignaturesView}
               />;
      case VIEWS.SIGNATURES:
        return <SignaturesView
                signaturesRequired={this.state.signaturesRequired}
                error={this.state.signaturesRequiredError}
                handleSignaturesRequiredChange={this.handleSignaturesRequiredChange}
                next={this.showPubKeysView}
                back={() => this.changeView(VIEWS.DEFAULT)}
               />;
      case VIEWS.PUBKEYS:
        return <PubKeysView
                publicKeys={this.state.publicKeys}
                publicKeyErrors={this.state.publicKeyErrors}
                handlePubKeyChange={this.handlePubKeyChange}
                handleSignaturesRequiredChange={this.handleSignaturesRequiredChange}
                addPublicKey={this.addPublicKey}
                error={this.state.error}
                next={this.makeMultiSig}
                back={() => this.changeView(VIEWS.SIGNATURES)}
               />;
      case VIEWS.COMPLETE:
        return <CompleteView
                address={this.props.address}
                payload={this.props.payload}
                next={this.exit}
               />;
      default:
        return <div></div>;
    }
  }

  render() {
    return (
      <PageWrapper title="Multi-signature Wallet">
        {this.renderView(this.state.view)}
      </PageWrapper>
    );
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(MultiSigWalletPage);
