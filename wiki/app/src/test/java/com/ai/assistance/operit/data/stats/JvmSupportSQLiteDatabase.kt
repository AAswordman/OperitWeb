package com.ai.assistance.operit.data.stats

import android.content.ContentValues
import android.database.Cursor
import android.net.Uri
import android.os.Bundle
import android.os.CancellationSignal
import android.util.Pair
import androidx.sqlite.db.SupportSQLiteDatabase
import androidx.sqlite.db.SupportSQLiteQuery
import androidx.sqlite.db.SupportSQLiteStatement
import java.sql.Connection
import java.sql.DriverManager
import java.sql.ResultSet
import java.sql.ResultSetMetaData
import java.util.Locale

/**
 * 纯 JVM 的最小 [SupportSQLiteDatabase] 测试替身（基于 sqlite-jdbc），
 * 用于直接驱动生产 `Migration.migrate(SupportSQLiteDatabase)` 变体。
 *
 * 只实现迁移路径实际用到的方法（execSQL / query / close / isOpen），
 * 其余方法抛 [UnsupportedOperationException]，避免无意义的全量模拟。
 *
 * 残余风险：生产环境该变体由 Room 的兼容模式（RoomOpenHelper +
 * SupportSQLiteConnection）驱动，包含事务包装与 schema 校验；本替身只覆盖
 * 迁移对象本身与共享 SQL 的真实执行，不覆盖 Room 兼容模式编排（需 Android 框架）。
 */
class JvmSupportSQLiteDatabase(private val connection: Connection) : SupportSQLiteDatabase {

    override fun execSQL(sql: String) {
        connection.createStatement().use { it.execute(sql) }
    }

    override fun execSQL(sql: String, bindArgs: Array<out Any?>) {
        connection.prepareStatement(sql).use { statement ->
            bindArgs.forEachIndexed { index, arg ->
                when (arg) {
                    null -> statement.setNull(index + 1, java.sql.Types.NULL)
                    is Long -> statement.setLong(index + 1, arg)
                    is Int -> statement.setLong(index + 1, arg.toLong())
                    is Double -> statement.setDouble(index + 1, arg)
                    is Float -> statement.setDouble(index + 1, arg.toDouble())
                    is Boolean -> statement.setInt(index + 1, if (arg) 1 else 0)
                    is ByteArray -> statement.setBytes(index + 1, arg)
                    else -> statement.setString(index + 1, arg.toString())
                }
            }
            statement.execute()
        }
    }

    override fun query(query: String): Cursor {
        val resultSet = connection.createStatement().executeQuery(query)
        return JvmCursor(resultSet)
    }

    override fun query(query: String, bindArgs: Array<out Any?>): Cursor {
        val statement = connection.prepareStatement(query)
        bindArgs.forEachIndexed { index, arg ->
            when (arg) {
                null -> statement.setNull(index + 1, java.sql.Types.NULL)
                is Long -> statement.setLong(index + 1, arg)
                is Int -> statement.setLong(index + 1, arg.toLong())
                is Double -> statement.setDouble(index + 1, arg)
                is Float -> statement.setDouble(index + 1, arg.toDouble())
                is Boolean -> statement.setInt(index + 1, if (arg) 1 else 0)
                is ByteArray -> statement.setBytes(index + 1, arg)
                else -> statement.setString(index + 1, arg.toString())
            }
        }
        return JvmCursor(statement.executeQuery(), statement)
    }

    override fun query(query: SupportSQLiteQuery): Cursor {
        val statement = connection.prepareStatement(query.sql)
        query.bindTo(object : androidx.sqlite.db.SupportSQLiteProgram {
            override fun bindNull(index: Int) = statement.setNull(index, java.sql.Types.NULL)
            override fun bindLong(index: Int, value: Long) = statement.setLong(index, value)
            override fun bindDouble(index: Int, value: Double) = statement.setDouble(index, value)
            override fun bindString(index: Int, value: String) = statement.setString(index, value)
            override fun bindBlob(index: Int, value: ByteArray) = statement.setBytes(index, value)
            override fun clearBindings() = statement.clearParameters()
            override fun close() = statement.close()
        })
        return JvmCursor(statement.executeQuery(), statement)
    }

    override fun query(query: SupportSQLiteQuery, cancellationSignal: CancellationSignal?): Cursor =
        query(query)

    override fun close() {
        connection.close()
    }

    override val isOpen: Boolean
        get() = !connection.isClosed

    override val path: String?
        get() = "jvm-sqlite"

    override val isReadOnly: Boolean
        get() = false

    override var version: Int
        get() = unsupported("version")
        set(value) = unsupported("version")

    override val maximumSize: Long
        get() = unsupported("maximumSize")

    override fun setMaximumSize(numBytes: Long): Long = unsupported("setMaximumSize")

    override var pageSize: Long
        get() = unsupported("pageSize")
        set(value) = unsupported("pageSize")

    override val isDbLockedByCurrentThread: Boolean
        get() = unsupported("isDbLockedByCurrentThread")

    override val isWriteAheadLoggingEnabled: Boolean
        get() = unsupported("isWriteAheadLoggingEnabled")

    override val attachedDbs: List<Pair<String, String>>?
        get() = unsupported("attachedDbs")

    override val isDatabaseIntegrityOk: Boolean
        get() = unsupported("isDatabaseIntegrityOk")

    override fun compileStatement(sql: String): SupportSQLiteStatement =
        unsupported("compileStatement")

    override fun beginTransaction() = unsupported("beginTransaction")

    override fun beginTransactionNonExclusive() = unsupported("beginTransactionNonExclusive")

    override fun beginTransactionWithListener(listener: android.database.sqlite.SQLiteTransactionListener) =
        unsupported("beginTransactionWithListener")

    override fun beginTransactionWithListenerNonExclusive(
        listener: android.database.sqlite.SQLiteTransactionListener,
    ) = unsupported("beginTransactionWithListenerNonExclusive")

    override fun endTransaction() = unsupported("endTransaction")

    override fun setTransactionSuccessful() = unsupported("setTransactionSuccessful")

    override fun inTransaction(): Boolean = unsupported("inTransaction")

    override fun yieldIfContendedSafely(): Boolean = unsupported("yieldIfContendedSafely")

    override fun yieldIfContendedSafely(sleepAfterYieldDelayMillis: Long): Boolean =
        unsupported("yieldIfContendedSafely")

    override fun insert(table: String, conflictAlgorithm: Int, values: ContentValues): Long =
        unsupported("insert")

    override fun delete(table: String, whereClause: String?, whereArgs: Array<out Any?>?): Int =
        unsupported("delete")

    override fun update(
        table: String,
        conflictAlgorithm: Int,
        values: ContentValues,
        whereClause: String?,
        whereArgs: Array<out Any?>?,
    ): Int = unsupported("update")

    override fun needUpgrade(newVersion: Int): Boolean = unsupported("needUpgrade")

    override fun setLocale(locale: Locale) = unsupported("setLocale")

    override fun setMaxSqlCacheSize(cacheSize: Int) = unsupported("setMaxSqlCacheSize")

    override fun setForeignKeyConstraintsEnabled(enable: Boolean) =
        unsupported("setForeignKeyConstraintsEnabled")

    override fun enableWriteAheadLogging(): Boolean = unsupported("enableWriteAheadLogging")

    override fun disableWriteAheadLogging() = unsupported("disableWriteAheadLogging")

    private fun unsupported(method: String): Nothing =
        throw UnsupportedOperationException(
            "JvmSupportSQLiteDatabase does not support $method (test double)"
        )

    companion object {
        fun open(dbPath: String): JvmSupportSQLiteDatabase =
            JvmSupportSQLiteDatabase(DriverManager.getConnection("jdbc:sqlite:$dbPath"))
    }
}

/** 最小 android.database.Cursor 实现：迁移路径只用到读取行与列。 */
private class JvmCursor(
    private val resultSet: ResultSet,
    private val closeable: AutoCloseable? = null,
) : Cursor {

    private val rows: List<Array<Any?>> = materialize(resultSet)
    private val columnNames: Array<String> = columnNames(resultSet.metaData)
    private val columnIndexByName: Map<String, Int> =
        columnNames.withIndex().associate { (index, name) -> name.lowercase() to index }
    private var position = -1
    private var closed = false

    override fun getCount(): Int = rows.size

    override fun getPosition(): Int = position

    override fun move(position: Int): Boolean = moveToPosition(this.position + position)

    override fun moveToPosition(position: Int): Boolean {
        if (position < -1 || position >= rows.size) {
            this.position = -1
            return false
        }
        this.position = position
        return true
    }

    override fun moveToFirst(): Boolean = moveToPosition(0)

    override fun moveToLast(): Boolean = moveToPosition(rows.size - 1)

    override fun moveToNext(): Boolean = moveToPosition(position + 1)

    override fun moveToPrevious(): Boolean = moveToPosition(position - 1)

    override fun isFirst(): Boolean = position == 0 && rows.isNotEmpty()

    override fun isLast(): Boolean = position == rows.size - 1 && position >= 0

    override fun isBeforeFirst(): Boolean = position < 0 && rows.isNotEmpty()

    override fun isAfterLast(): Boolean = position >= rows.size

    override fun getColumnCount(): Int = columnNames.size

    override fun getColumnIndex(columnName: String): Int =
        columnIndexByName[columnName.lowercase()] ?: -1

    override fun getColumnIndexOrThrow(columnName: String): Int {
        val index = getColumnIndex(columnName)
        if (index < 0) throw IllegalArgumentException("column '$columnName' does not exist")
        return index
    }

    override fun getColumnName(columnIndex: Int): String = columnNames[columnIndex]

    override fun getColumnNames(): Array<String> = columnNames.copyOf()

    override fun getString(columnIndex: Int): String {
        val value = row()[columnIndex]
        return when (value) {
            null -> ""
            is ByteArray -> String(value)
            else -> value.toString()
        }
    }

    override fun getLong(columnIndex: Int): Long {
        val value = row()[columnIndex]
        return when (value) {
            null -> 0L
            is Number -> value.toLong()
            else -> value.toString().toLong()
        }
    }

    override fun getInt(columnIndex: Int): Int = getLong(columnIndex).toInt()

    override fun getShort(columnIndex: Int): Short = getLong(columnIndex).toShort()

    override fun getFloat(columnIndex: Int): Float {
        val value = row()[columnIndex]
        return when (value) {
            null -> 0f
            is Number -> value.toFloat()
            else -> value.toString().toFloat()
        }
    }

    override fun getDouble(columnIndex: Int): Double {
        val value = row()[columnIndex]
        return when (value) {
            null -> 0.0
            is Number -> value.toDouble()
            else -> value.toString().toDouble()
        }
    }

    override fun getBlob(columnIndex: Int): ByteArray = (row()[columnIndex] as? ByteArray) ?: ByteArray(0)

    override fun isNull(columnIndex: Int): Boolean = row()[columnIndex] == null

    override fun getType(columnIndex: Int): Int {
        val value = row()[columnIndex]
        return when (value) {
            null -> android.database.Cursor.FIELD_TYPE_NULL
            is ByteArray -> android.database.Cursor.FIELD_TYPE_BLOB
            is String -> android.database.Cursor.FIELD_TYPE_STRING
            is Number -> android.database.Cursor.FIELD_TYPE_INTEGER
            else -> android.database.Cursor.FIELD_TYPE_STRING
        }
    }

    override fun close() {
        if (!closed) {
            closed = true
            closeable?.close()
            resultSet.close()
        }
    }

    override fun isClosed(): Boolean = closed

    override fun deactivate() = Unit

    override fun requery(): Boolean = false

    override fun copyStringToBuffer(columnIndex: Int, buffer: android.database.CharArrayBuffer) =
        unsupported("copyStringToBuffer")

    override fun getWantsAllOnMoveCalls(): Boolean = false

    override fun getExtras(): Bundle? = null

    override fun setExtras(extras: Bundle?) = Unit

    override fun respond(extras: Bundle?): Bundle? = null

    override fun getNotificationUri(): Uri? = null

    override fun setNotificationUri(cr: android.content.ContentResolver, notifyUri: Uri?) = Unit

    override fun registerContentObserver(observer: android.database.ContentObserver) = Unit

    override fun unregisterContentObserver(observer: android.database.ContentObserver) = Unit

    override fun registerDataSetObserver(observer: android.database.DataSetObserver) = Unit

    override fun unregisterDataSetObserver(observer: android.database.DataSetObserver) = Unit

    private fun row(): Array<Any?> {
        if (position < 0 || position >= rows.size) {
            throw IllegalStateException("cursor position $position is out of range")
        }
        return rows[position]
    }

    private fun unsupported(method: String): Nothing =
        throw UnsupportedOperationException("JvmCursor does not support $method (test double)")

    private companion object {
        fun materialize(resultSet: ResultSet): List<Array<Any?>> {
            val rows = mutableListOf<Array<Any?>>()
            val columnCount = resultSet.metaData.columnCount
            while (resultSet.next()) {
                val row = arrayOfNulls<Any?>(columnCount)
                for (i in 1..columnCount) {
                    row[i - 1] = resultSet.getObject(i)
                }
                rows += row
            }
            return rows
        }

        fun columnNames(metaData: ResultSetMetaData): Array<String> =
            Array(metaData.columnCount) { index -> metaData.getColumnName(index + 1) }
    }
}
