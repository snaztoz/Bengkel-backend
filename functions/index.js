const admin = require('firebase-admin')
const faker = require('faker')
const functions = require('firebase-functions')
const geofire = require('geofire-common')

admin.initializeApp()

exports.seedDatabase = functions.https
    .onRequest(async (req, res) => {
        const {lat, long} = req.query
        if (!lat || !long) {
            res.status(400).json({error: 'required URL query: lat & long'})
        }

        const LATITUDE = Number(lat)
        const LONGITUDE = Number(long)

        const promises = []
        let counter = 0

        // generate 20 data dummy
        for (let i = 0; i < 20; i++) {
            const q = admin.firestore()
                .collection('bengkel')
                .add({
                    nama: faker.company.companyName(),
                    alamat: faker.address.streetAddress(),
                    lokasi: {
                        latitude: Number(faker.address.latitude(LATITUDE + 0.1, LATITUDE - 0.1, 6)),
                        longitude: Number(faker.address.longitude(LONGITUDE + 0.1, LONGITUDE - 0.1, 6))
                    }
                })
                .then(() => counter++)

            promises.push(q)
        }

        await Promise.all(promises)
        res.status(200).json({'msg': `success menambah ${counter} data`})
    })

exports.getNearbyBengkel = functions.https
    .onRequest(async (req, res) => {
        const {lat, long} = req.query
        if (!lat || !long) {
            res.status(400).json({error: 'required URL query: lat & long'})
        }

        console.log(lat + " dan " + long)

        const position = [Number(lat), Number(long)]
        const radiusInM = 10000

        const bounds = geofire.geohashQueryBounds(position, radiusInM)
        const promises = []

        for (const b of bounds) {
            const q = admin.firestore()
                .collection('bengkel')
                .where('geohash', '!=', null)
                .orderBy('geohash')
                .startAt(b[0])
                .endAt(b[1])

            promises.push(q.get())
        }

        const snapshots = await Promise.all(promises)
        const matchingDocs = []

        for (const snap of snapshots) {
            for (const doc of snap.docs) {
                const location = doc.get('lokasi')

                // Filter lokasi yang benar-benar di dalam radius distanceInM
                //
                // Hal ini diperlukan karena adanya kasus dimana terdapat error
                // relatif dari kalkulasi geohash
                const distanceInKm = geofire.distanceBetween(
                    [location.latitude, location.longitude],
                    position
                )
                const distanceInM = distanceInKm * 1000
                if (distanceInM <= radiusInM) {
                    matchingDocs.push(doc)
                }
            }
        }

        const result = matchingDocs
            .map(doc => {
                data = doc.data()
                data.id = doc.id
                data.distance = geofire.distanceBetween(
                    [data.lokasi.latitude, data.lokasi.longitude],
                    position
                )
                return data
            })
            .sort((bengkel1, bengkel2) => bengkel1.distance - bengkel2.distance)

        res.status(200).json({result})
    })

exports.addBengkelGeohash = functions.firestore.document('/bengkel/{bengkelId}')
    .onCreate(snap => {
        const data = snap.data()

        const lat = data.lokasi.latitude
        const long = data.lokasi.longitude
        const geohash = geofire.geohashForLocation([Number(lat), Number(long)])

        return snap.ref.set({geohash}, {merge: true})
    })
