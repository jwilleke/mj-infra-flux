# MacOS settings to work on LAN

## Allow locak network access

```zsh
sudo defaults write /Library/Preferences/com.apple.network.local-network AllowedWiFiLocalNetworkAddresses -array "192.168.0.0/16" "10.0.0.0/8"
sudo defaults write /Library/Preferences/com.apple.network.local-network AllowedEthernetLocalNetworkAddresses -array "192.168.0.0/16" "10.0.0.0/8"
# Restart networking / mDNSResponder to apply
sudo killall -HUP mDNSResponder
```
