package com.ai.assistance.operit.ui.common.composedsl

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class ComposeDslFilePickerRequestTest {
    @Test
    fun `defaults to document picker with persisted access`() {
        val request = parseComposeDslFilePickerRequest(payload())

        assertEquals(ComposeDslFilePickerMode.DOCUMENT, request.pickerMode)
        assertEquals(listOf("*/*"), request.mimeTypes)
        assertFalse(request.allowMultiple)
        assertTrue(request.persistPermission)
    }

    @Test
    fun `accepts document MIME filters and all supported picker modes`() {
        val documentRequest =
            parseComposeDslFilePickerRequest(
                payload(
                    JSONObject()
                        .put("picker", "document")
                        .put("mimeTypes", JSONArray().put("application/json").put("text/plain"))
                        .put("allowMultiple", true)
                        .put("persistPermission", false)
                )
            )

        assertEquals(listOf("application/json", "text/plain"), documentRequest.mimeTypes)
        assertTrue(documentRequest.allowMultiple)
        assertFalse(documentRequest.persistPermission)

        listOf(
            ComposeDslFilePickerMode.IMAGE,
            ComposeDslFilePickerMode.VIDEO,
            ComposeDslFilePickerMode.MEDIA,
            ComposeDslFilePickerMode.DIRECTORY,
            ComposeDslFilePickerMode.CAMERA
        ).forEach { mode ->
            val request =
                parseComposeDslFilePickerRequest(
                    payload(JSONObject().put("picker", mode.wireName))
                )

            assertEquals(mode, request.pickerMode)
            assertTrue(request.mimeTypes.isEmpty())
        }
    }

    @Test
    fun `rejects removed photo mode`() {
        assertInvalid(payload(JSONObject().put("picker", "photo")), "unsupported file picker mode")
    }

    @Test
    fun `rejects options that do not apply to the selected source`() {
        assertInvalid(
            payload(
                JSONObject()
                    .put("picker", "image")
                    .put("mimeTypes", JSONArray().put("image/*"))
            ),
            "does not support mimeTypes"
        )
        assertInvalid(
            payload(JSONObject().put("picker", "directory").put("allowMultiple", true)),
            "does not support allowMultiple"
        )
        assertInvalid(
            payload(JSONObject().put("picker", "camera").put("persistPermission", false)),
            "does not support persistPermission"
        )
    }

    private fun payload(options: JSONObject? = null): JSONObject =
        JSONObject()
            .put("executionContextKey", "test-context")
            .apply {
                if (options != null) {
                    put("options", options)
                }
            }

    private fun assertInvalid(payload: JSONObject, expectedMessage: String) {
        try {
            parseComposeDslFilePickerRequest(payload)
            fail("Expected invalid file picker request")
        } catch (error: IllegalArgumentException) {
            assertTrue(error.message.orEmpty().contains(expectedMessage))
        }
    }
}
