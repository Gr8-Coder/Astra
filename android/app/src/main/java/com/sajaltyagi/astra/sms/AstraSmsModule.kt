package com.sajaltyagi.astra.sms

import android.Manifest
import android.content.pm.PackageManager
import android.provider.Telephony
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AstraSmsModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  override fun getName(): String = "AstraSmsModule"

  @ReactMethod
  fun listMessages(limit: Int, sinceEpochMs: Double, promise: Promise) {
    val permissionState = ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.READ_SMS
    )

    if (permissionState != PackageManager.PERMISSION_GRANTED) {
      promise.reject("E_PERMISSION", "READ_SMS permission is not granted.")
      return
    }

    val maxRows = when {
      limit <= 0 -> 250
      limit > 1000 -> 1000
      else -> limit
    }
    val sinceMillis = sinceEpochMs.toLong()
    val projection = arrayOf(
      Telephony.Sms._ID,
      Telephony.Sms.ADDRESS,
      Telephony.Sms.BODY,
      Telephony.Sms.DATE
    )
    val selection = if (sinceMillis > 0) "${Telephony.Sms.DATE} >= ?" else null
    val selectionArgs = if (sinceMillis > 0) arrayOf(sinceMillis.toString()) else null
    val sortOrder = "${Telephony.Sms.DATE} DESC"

    try {
      val cursor = context.contentResolver.query(
        Telephony.Sms.Inbox.CONTENT_URI,
        projection,
        selection,
        selectionArgs,
        sortOrder
      )

      if (cursor == null) {
        promise.resolve(Arguments.createArray())
        return
      }

      cursor.use {
        val idIndex = it.getColumnIndexOrThrow(Telephony.Sms._ID)
        val addressIndex = it.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
        val bodyIndex = it.getColumnIndexOrThrow(Telephony.Sms.BODY)
        val dateIndex = it.getColumnIndexOrThrow(Telephony.Sms.DATE)
        val results = Arguments.createArray()
        var count = 0

        while (it.moveToNext() && count < maxRows) {
          val row = Arguments.createMap()
          row.putString("id", it.getString(idIndex))
          row.putString("address", it.getString(addressIndex))
          row.putString("body", it.getString(bodyIndex))
          row.putDouble("date", it.getLong(dateIndex).toDouble())
          results.pushMap(row)
          count += 1
        }

        promise.resolve(results)
      }
    } catch (error: Exception) {
      promise.reject("E_SMS_QUERY", error.message, error)
    }
  }
}
