# weird-audiobook

![demo](/assets/weird-audiobook-demo.gif)

This service provides audiobook feature for [weird-meetup blog](http://blog.weirdx.io)

## Architecture Diagram

![diagram](/assets/weird-audiobook-diagram.png)


## What's this do?

- Fetch article from weird meetup blog
- Speech texts by using AWS Polly, Naver Clova CSS
- Transcode speeched audios to multiple formats (e.g. HLS AAC, MP3)

## Benefits

- Built with fully managed serverless services
- Pay as you go. There's no fixed fee.
- Extremely Cheap
- Audio files are transferred via CDN (Cloudfront)
- Audio delivery is optimized by default. (Optimized bitrate/sample rate, HLS)


## Getting Started

```bash
$ git clone https://github.com/mooyoul/weird-audiobook.git
$ cd weird-audiobook
$ npm i
$ vi env/prod.yml
$ env STAGE=prod npm run migrate:db
$ vi serverless.yml # Edit "EDIT ME" sections
$ npm run deploy:prod 
```

That's it!

## License
[MIT](LICENSE)

See full license on [mooyoul.mit-license.org](http://mooyoul.mit-license.org/)

