import {
  Authenticator,
  UALError,
  UALErrorType,
} from "universal-authenticator-library";
import { Keycat } from "@telosnetwork/telos-keycatjs";
import { JsonRpc } from "eosjs";
import TelosSignLogo from "./TelosSignLogo";
import KeycatUser from "./KeycatUser";

const chainMap = {
  "4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11": "telos",
  "1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f":
    "telos-testnet",
};

class KeycatAuthenticator extends Authenticator {
  constructor(chains, options) {
    super(chains, options);
    const opts = options || {};
    let { selectedChainId } = opts;
    selectedChainId = selectedChainId || chains[0].chainId;
    this.keycatMap = this._getKeycatMap(chains);
    this.selectedChainId = selectedChainId;
    this.rpc = opts.rpc || this._createRpc();
    this.defaultInvalidateAfter = 604800;
  }

  _createRpc() {
    const selectedKeycatChain = this.keycatMap[this.selectedChainId];
    const node = selectedKeycatChain.config.blockchain.nodes[0];
    return new JsonRpc(node);
  }

  _getKeycatMap(chains) {
    const keycatMap = {};
    for (const chain of chains) {
      const { chainId, rpcEndpoints, origin } = chain;
      console.log("ual-telos-keycat chain is: ", chain);
      const name = chainMap[chainId];
      if (name) {
        const nodes = [];
        for (const rpcEndpoint of rpcEndpoints) {
          const { protocol, host, port } = rpcEndpoint;
          nodes.push(`${protocol}://${host}:${port}`);
        }

        keycatMap[chainId] = new Keycat({
          blockchain: {
            name,
            nodes,
            origin,
          },
        });
      }
    }
    return keycatMap;
  }

  async init() {
    this.keycatError = null;
    this.keycatIsLoading = false;
    this.keycat = this.keycatMap[this.selectedChainId];
    if (!this.keycat) {
      this.keycatError = new UALError(
        `Chain: ${this.selectedChainId} not supported`,
        UALErrorType.Initialization
      );
    }
  }

  /**
   * Resets the authenticator to its initial, default state then calls init method
   */
  reset() {
    this.init();
  }

  /**
   * Returns true if the authenticator has errored while initializing.
   */
  isErrored() {
    return !!this.keycatError;
  }

  getName() {
    return "Telos Sign";
  }

  /**
   * Returns a URL where the user can download and install the underlying authenticator
   * if it is not found by the UAL Authenticator.
   */
  getOnboardingLink() {
    return "https://keycatdev.gitbook.io/keycatjs/";
  }

  /**
   * Returns error (if available) if the authenticator has errored while initializing.
   */
  getError() {
    return this.keycatError;
  }

  /**
   * Returns true if the authenticator is loading while initializing its internal state.
   */
  isLoading() {
    return this.keycatIsLoading;
  }
  /**
   * Returns the style of the Button that will be rendered.
   */

  getStyle() {
    return {
      // An icon displayed to app users when selecting their authentication method
      icon: TelosSignLogo,
      // Name displayed to app users
      text: "Telos Sign",
      // Background color displayed to app users who select your authenticator
      background: "#030238",
      // Color of text used on top the `backgound` property above
      textColor: "#FFFFFF",
    };
  }

  /**
   * Returns whether or not the button should render based on the operating environment and other factors.
   * ie. If your Authenticator App does not support mobile, it returns false when running in a mobile browser.
   */
  shouldRender() {
    return true;
  }

  /**
   * Returns whether or not the dapp should attempt to auto login with the Authenticator app.
   * Auto login will only occur when there is only one Authenticator that returns shouldRender() true and
   * shouldAutoLogin() true.
   */
  shouldAutoLogin() {
    return false;
  }

  /**
   * Returns whether or not the button should show an account name input field.
   * This is for Authenticators that do not have a concept of account names.
   */
  async shouldRequestAccountName() {
    return false;
  }

  /**
   * Login using the Authenticator App. This can return one or more users depending on multiple chain support.
   *
   * @param accountName  The account name of the user for Authenticators that do not store accounts (optional)
   */
  async login() {
    try {
      let accountName;
      let permission;
      let publicKey;

      const nowTimestamp = Math.floor(new Date().getTime() / 1000);
      accountName = window.localStorage.getItem("accountName");
      permission = window.localStorage.getItem("permission");
      publicKey = window.localStorage.getItem("publicKey");
      let expiration = window.localStorage.getItem("expiration");

      const isBeforeExpiration = parseInt(expiration || 0, 10) > nowTimestamp;
      if (!(accountName && permission && publicKey && isBeforeExpiration)) {
        const signinData = await this.keycat.signin();
        accountName = signinData.accountName;
        permission = signinData.permission;
        publicKey = signinData.publicKey;
        expiration = this.shouldInvalidateAfter() + nowTimestamp;
        window.localStorage.setItem("expiration", expiration);
        window.localStorage.setItem("accountName", accountName);
        window.localStorage.setItem("permission", permission);
        window.localStorage.setItem("publicKey", publicKey);
      }

      return [
        new KeycatUser({
          accountName,
          permission,
          publicKey,
          keycat: this.keycat,
          chainId: this.selectedChainId,
          rpc: this.rpc,
        }),
      ];
    } catch (err) {
      throw new UALError(err.messsage, UALErrorType.Login, err);
    }
  }

  /**
   * Logs the user out of the dapp. This will be strongly dependent on each
   * Authenticator app's patterns.
   */
  async logout() {
    window.localStorage.removeItem("accountName");
    window.localStorage.removeItem("permission");
    window.localStorage.removeItem("publicKey");
    window.localStorage.removeItem("expiration");
    return true;
  }

  shouldInvalidateAfter() {
    return this.defaultInvalidateAfter;
  }

  /**
   * Returns true if user confirmation is required for `getKeys`
   */
  requiresGetKeyConfirmation() {
    return false;
  }
}

export default KeycatAuthenticator;
