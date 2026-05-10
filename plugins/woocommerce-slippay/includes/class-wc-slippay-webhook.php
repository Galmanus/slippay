<?php
/**
 * SlipPay webhook receiver.
 * Listens at /wc-api/wc_slippay (registered automatically by WC's API
 * dispatcher when the woocommerce_api_<id> action fires). Verifies HMAC
 * if a webhook_secret is configured, then marks the matching WC order
 * as paid (or underpaid / cancelled / expired).
 *
 * @package WooCommerce_Slippay
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class WC_Slippay_Webhook {

    public function __construct() {
        add_action( 'woocommerce_api_wc_slippay', [ $this, 'handle' ] );
    }

    public function handle() {
        $raw = file_get_contents( 'php://input' );
        if ( ! $raw ) {
            status_header( 400 );
            echo wp_json_encode( [ 'error' => 'empty body' ] );
            exit;
        }

        $gateway = $this->get_gateway();
        $secret  = $gateway ? $gateway->get_option( 'webhook_secret' ) : '';

        // HMAC verification (header name follows SlipPay convention; falls back
        // to common alternatives if the upstream chooses a different label).
        if ( ! empty( $secret ) ) {
            $sig = $this->get_signature_header();
            if ( empty( $sig ) ) {
                status_header( 401 );
                echo wp_json_encode( [ 'error' => 'missing signature header' ] );
                exit;
            }
            $computed = hash_hmac( 'sha256', $raw, $secret );
            if ( ! hash_equals( $computed, $sig ) ) {
                status_header( 401 );
                echo wp_json_encode( [ 'error' => 'invalid signature' ] );
                exit;
            }
        }

        $payload = json_decode( $raw, true );
        if ( ! is_array( $payload ) || empty( $payload['type'] ) || empty( $payload['data']['id'] ) ) {
            status_header( 400 );
            echo wp_json_encode( [ 'error' => 'malformed payload' ] );
            exit;
        }

        $slippay_order_id = sanitize_text_field( $payload['data']['id'] );
        $type             = sanitize_key( $payload['type'] );
        $tx_hash          = isset( $payload['data']['tx_hash'] ) ? sanitize_text_field( $payload['data']['tx_hash'] ) : '';

        $wc_order = $this->find_order_by_slippay_id( $slippay_order_id );
        if ( ! $wc_order ) {
            status_header( 404 );
            echo wp_json_encode( [ 'error' => 'wc order not found', 'slippay_id' => $slippay_order_id ] );
            exit;
        }

        switch ( $type ) {
            case 'order.paid':
            case 'subscription.charged':
                if ( $tx_hash ) {
                    $wc_order->update_meta_data( '_slippay_tx_hash', $tx_hash );
                }
                $wc_order->payment_complete( $tx_hash );
                $wc_order->add_order_note( sprintf(
                    'SlipPay %s confirmed. tx: %s',
                    $type,
                    $tx_hash ?: 'n/a'
                ) );
                break;

            case 'order.underpaid':
                $wc_order->update_status( 'on-hold', sprintf(
                    'SlipPay underpayment. expected %s, received %s',
                    isset( $payload['data']['expected'] ) ? $payload['data']['expected'] : '?',
                    isset( $payload['data']['received'] ) ? $payload['data']['received'] : '?'
                ) );
                break;

            case 'order.expired':
                $wc_order->update_status( 'cancelled', 'SlipPay order expired before payment.' );
                break;

            case 'order.cancelled':
                $wc_order->update_status( 'cancelled', 'SlipPay order cancelled.' );
                break;

            default:
                $wc_order->add_order_note( 'SlipPay event received (no-op for this type): ' . $type );
                break;
        }

        $wc_order->save();
        status_header( 200 );
        echo wp_json_encode( [ 'ok' => true ] );
        exit;
    }

    private function get_signature_header() {
        // SlipPay convention: X-Slippay-Signature
        if ( isset( $_SERVER['HTTP_X_SLIPPAY_SIGNATURE'] ) ) {
            return sanitize_text_field( $_SERVER['HTTP_X_SLIPPAY_SIGNATURE'] );
        }
        if ( isset( $_SERVER['HTTP_X_SIGNATURE'] ) ) {
            return sanitize_text_field( $_SERVER['HTTP_X_SIGNATURE'] );
        }
        return '';
    }

    private function find_order_by_slippay_id( $slippay_order_id ) {
        $orders = wc_get_orders( [
            'limit'      => 1,
            'meta_key'   => '_slippay_order_id',
            'meta_value' => $slippay_order_id,
        ] );
        if ( empty( $orders ) ) {
            // Fallback: external_ref pattern wc_<id>
            if ( preg_match( '/^wc_(\d+)$/', $slippay_order_id, $m ) ) {
                return wc_get_order( (int) $m[1] );
            }
            return null;
        }
        return $orders[0];
    }

    private function get_gateway() {
        $gateways = WC()->payment_gateways()->payment_gateways();
        return isset( $gateways['slippay'] ) ? $gateways['slippay'] : null;
    }
}
