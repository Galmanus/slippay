<?php
/**
 * SlipPay payment gateway class.
 * Hooks into WooCommerce checkout: when buyer picks SlipPay, the plugin
 * calls POST /api/v1/orders on the SlipPay backend, then redirects the
 * buyer to the hosted checkout URL. Confirmation comes back via webhook.
 *
 * @package WooCommerce_Slippay
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class WC_Slippay_Gateway extends WC_Payment_Gateway {

    public function __construct() {
        $this->id                 = 'slippay';
        $this->method_title       = __( 'SlipPay (USDC / PYUSD on Stellar)', 'woocommerce-slippay' );
        $this->method_description = __( 'Accept stablecoin payments via SlipPay. Buyer pays in BRL via Pix; merchant receives USDC or PYUSD on Stellar in 6 seconds. No chargebacks. Non-custodial.', 'woocommerce-slippay' );
        $this->has_fields         = false;

        $this->init_form_fields();
        $this->init_settings();

        $this->title         = $this->get_option( 'title' );
        $this->description   = $this->get_option( 'description' );
        $this->enabled       = $this->get_option( 'enabled' );
        $this->api_key       = $this->get_option( 'api_key' );
        $this->api_base      = $this->get_option( 'api_base', 'https://api.slippay.cc' );
        $this->webhook_secret = $this->get_option( 'webhook_secret' );
        $this->asset_code    = $this->get_option( 'asset_code', 'USDC' );
        $this->environment   = $this->get_option( 'environment', 'testnet' );

        $this->icon = apply_filters( 'wc_slippay_icon', plugins_url( 'assets/slippay-mark.svg', WC_SLIPPAY_PLUGIN_FILE ) );

        add_action( 'woocommerce_update_options_payment_gateways_' . $this->id, [ $this, 'process_admin_options' ] );
    }

    public function init_form_fields() {
        $this->form_fields = [
            'enabled' => [
                'title'   => __( 'Enable / Disable', 'woocommerce-slippay' ),
                'type'    => 'checkbox',
                'label'   => __( 'Enable SlipPay payments', 'woocommerce-slippay' ),
                'default' => 'no',
            ],
            'environment' => [
                'title'   => __( 'Environment', 'woocommerce-slippay' ),
                'type'    => 'select',
                'options' => [
                    'testnet' => __( 'Testnet (free, no real money)', 'woocommerce-slippay' ),
                    'mainnet' => __( 'Mainnet (real USDC settles to merchant)', 'woocommerce-slippay' ),
                ],
                'default' => 'testnet',
                'description' => __( 'Use testnet to test the integration before going live.', 'woocommerce-slippay' ),
            ],
            'title' => [
                'title'       => __( 'Title at checkout', 'woocommerce-slippay' ),
                'type'        => 'text',
                'default'     => __( 'Pay with SlipPay (USDC or PYUSD)', 'woocommerce-slippay' ),
                'description' => __( 'What buyers see at checkout.', 'woocommerce-slippay' ),
            ],
            'description' => [
                'title'   => __( 'Description at checkout', 'woocommerce-slippay' ),
                'type'    => 'textarea',
                'default' => __( 'Pay in BRL via Pix or in stablecoin (USDC / PYUSD) on Stellar. Settles in roughly 6 seconds. Non-custodial: your funds go directly to the merchant wallet.', 'woocommerce-slippay' ),
            ],
            'api_base' => [
                'title'       => __( 'SlipPay API base URL', 'woocommerce-slippay' ),
                'type'        => 'text',
                'default'     => 'https://api.slippay.cc',
                'description' => __( 'Override only if you self-host SlipPay or use a custom region endpoint.', 'woocommerce-slippay' ),
            ],
            'api_key' => [
                'title'       => __( 'API key', 'woocommerce-slippay' ),
                'type'        => 'password',
                'description' => __( 'Get this from your SlipPay merchant dashboard, Settings tab. Format: sk_live_...', 'woocommerce-slippay' ),
            ],
            'asset_code' => [
                'title'   => __( 'Default settlement asset', 'woocommerce-slippay' ),
                'type'    => 'select',
                'options' => [
                    'USDC'  => 'USDC (Circle)',
                    'PYUSD' => 'PYUSD (PayPal)',
                ],
                'default' => 'USDC',
            ],
            'webhook_secret' => [
                'title'       => __( 'Webhook secret', 'woocommerce-slippay' ),
                'type'        => 'password',
                'description' => __( 'Optional but strongly recommended. Set the same secret in your SlipPay merchant settings under webhook_url. Plugin verifies HMAC-SHA256 on each delivery.', 'woocommerce-slippay' ),
            ],
        ];
    }

    /**
     * Called when the customer clicks Place Order with SlipPay selected.
     * Returns redirect to the SlipPay-hosted checkout for the new order.
     */
    public function process_payment( $order_id ) {
        $order = wc_get_order( $order_id );
        if ( ! $order ) {
            wc_add_notice( __( 'Could not load order.', 'woocommerce-slippay' ), 'error' );
            return [ 'result' => 'fail' ];
        }

        if ( empty( $this->api_key ) ) {
            wc_add_notice( __( 'SlipPay API key not configured.', 'woocommerce-slippay' ), 'error' );
            return [ 'result' => 'fail' ];
        }

        // BRL amount with two decimals (SlipPay schema validates ^\d{1,9}\.\d{2}$).
        $brl = number_format( (float) $order->get_total(), 2, '.', '' );

        $body = wp_json_encode( [
            'brl_amount'         => $brl,
            'external_ref'       => 'wc_' . $order->get_id(),
            'expires_in_minutes' => 30,
        ] );

        $response = wp_remote_post( trailingslashit( $this->api_base ) . 'api/v1/orders', [
            'headers' => [
                'Authorization' => 'Bearer ' . $this->api_key,
                'Content-Type'  => 'application/json',
            ],
            'body'    => $body,
            'timeout' => 15,
        ] );

        if ( is_wp_error( $response ) ) {
            $order->add_order_note( 'SlipPay request error: ' . $response->get_error_message() );
            wc_add_notice( __( 'Payment service unreachable. Try again.', 'woocommerce-slippay' ), 'error' );
            return [ 'result' => 'fail' ];
        }

        $code = wp_remote_retrieve_response_code( $response );
        $data = json_decode( wp_remote_retrieve_body( $response ), true );

        if ( $code !== 201 || empty( $data['order']['id'] ) || empty( $data['checkout_url'] ) ) {
            $detail = isset( $data['detail'] ) ? $data['detail'] : ( isset( $data['error'] ) ? $data['error'] : 'unknown' );
            $order->add_order_note( 'SlipPay order create failed (' . $code . '): ' . $detail );
            wc_add_notice( __( 'Payment failed to initiate. Please try again.', 'woocommerce-slippay' ), 'error' );
            return [ 'result' => 'fail' ];
        }

        // Store the SlipPay order id so the webhook can match back.
        $order->update_meta_data( '_slippay_order_id', sanitize_text_field( $data['order']['id'] ) );
        $order->update_meta_data( '_slippay_memo',     sanitize_text_field( $data['order']['memo'] ) );
        $order->update_meta_data( '_slippay_usdc_amount', sanitize_text_field( $data['order']['usdc_amount'] ) );
        $order->save();

        $order->update_status( 'pending', __( 'SlipPay order created. Awaiting on-chain payment.', 'woocommerce-slippay' ) );

        return [
            'result'   => 'success',
            'redirect' => $data['checkout_url'],
        ];
    }

    /**
     * Hide gateway from BRL <0.01 carts (SlipPay schema requires positive amount).
     */
    public function is_available() {
        if ( 'yes' !== $this->enabled )       return false;
        if ( empty( $this->api_key ) )        return false;
        if ( WC()->cart && WC()->cart->total <= 0 ) return false;
        return parent::is_available();
    }
}
