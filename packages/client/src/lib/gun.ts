import Gun from 'gun';

// We need to connect to public "Relay Nodes" so users can find each other.
// These are free, community-run servers that just bounce signals.
const gun = Gun({
  peers: [
   'https://3f1fb3bf-99e3-415b-83ae-8821402ae4dd-00-cau89310wj6w.sisko.replit.dev/gun',
    'https://gun-manhattan.herokuapp.com/gun', // The main community relay
    'https://relay.1234.as/gun',              // Backup relay
    'https://gun-us.herokuapp.com/gun'        // Backup relay
  ]
});

export default gun;