const admin = require('firebase-admin');
const functions = require("firebase-functions");

admin.initializeApp();

exports.getNearbyBengkel = functions.https
    .onRequest(async (req, res) => {
        const {lat, long} = req.query
        if (!lat || !long) {
            res.status(400).json({error: 'required URL query: lat & long'})
        }

        const collection = await admin.firestore()
            .collection('bengkel')
            .where('lokasi', '!=', null) // filter yang tidak memiliki field lokasi
            .get()

        const bengkelList = collection.docs
            .map(doc => {
                data = doc.data()
                data.id = doc.id
                data.jarak = Math.abs(Math.sqrt(
                    Math.pow(data.lokasi.latitude - lat, 2)
                    + Math.pow(data.lokasi.longitude - long, 2)
                ))

                return data
            })
            .sort((bengkel1, bengkel2) => bengkel1.jarak - bengkel2.jarak)

        res.status(200).json({result: bengkelList})
    })
