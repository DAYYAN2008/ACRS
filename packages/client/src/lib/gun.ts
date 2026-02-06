import Gun from 'gun';

let gun: any = null;

// Only initialize Gun if we are in the browser
if (typeof window !== 'undefined') {
  gun = Gun({
    peers: [
      'https://gun-manhattan.herokuapp.com/gun',
      'https://gun-us.herokuapp.com/gun'
    ],
    localStorage: true,
    radisk: true
  });
}

export default gun;