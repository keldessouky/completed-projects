package com.techelevator.model.dao.jdbc;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import javax.sql.DataSource;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.rowset.SqlRowSet;

import com.techelevator.model.dao.ReservationDAO;
import com.techelevator.model.domain.Reservation;

public class JDBCReservationDAO implements ReservationDAO {

	private JdbcTemplate jdbcTemplate;


	public JDBCReservationDAO(DataSource dataSource) {
		this.jdbcTemplate = new JdbcTemplate(dataSource);
	}

	@Override
	public List<Reservation> getReservationAvailability(String venueName, String startDate, int numberOfDays,
			int numberOfAttendees) {

		LocalDate startDateAsLocal = convertStartDate(startDate);
		LocalDate end_date = startDateAsLocal.plusDays(numberOfDays);
		String endDateString = end_date.toString();
		
		List<Reservation> getAvailableSpaces = new ArrayList<>();
		String sqlGetAvailableSpaces = "SELECT space.id, space.name, venue.name AS venue_name, CAST(space.daily_rate AS decimal),"
				+ " space.open_from, space.open_to, space.max_occupancy, space.is_accessible FROM space "
				+ "JOIN venue ON venue.id = space.venue_id WHERE venue.name = ? AND max_occupancy >= ? "
				+ "AND NOT EXISTS (SELECT * FROM reservation "
				+ "WHERE (CAST(? AS DATE) BETWEEN reservation.start_date AND reservation.end_date "
				+ "OR CAST(? AS DATE) BETWEEN reservation.start_date AND reservation.end_date) "
				+ "AND reservation.space_id = space.id) "
				+ "AND ((EXTRACT(MONTH from CAST(? AS DATE)) BETWEEN space.open_from AND space.open_to) OR space.open_from IS NULL AND space.open_to IS NULL) "
				+ "AND ((EXTRACT(MONTH from CAST(? AS DATE)) BETWEEN space.open_from AND space.open_to) OR space.open_from IS NULL AND space.open_to IS NULL) "
				+ "GROUP BY space.id, venue.name ORDER BY CAST(space.daily_rate AS decimal) ASC LIMIT 5;";
		SqlRowSet results = jdbcTemplate.queryForRowSet(sqlGetAvailableSpaces, venueName, numberOfAttendees, startDate,
				endDateString, startDate, endDateString);
		while (results.next()) {
			Reservation reservation = mapRowToReservation(results);
			getAvailableSpaces.add(reservation);
		}
		return getAvailableSpaces;
	}






	private Reservation mapRowToReservation(SqlRowSet results) {
		Reservation reservation = new Reservation();
		reservation.setSpaceId(results.getInt("id"));
		reservation.setSpaceName(results.getString("name"));
		reservation.setVenueName(results.getString("venue_name"));
		reservation.setDailyRate(results.getDouble("daily_rate"));
		reservation.setStartDate(results.getString("open_from"));
		reservation.setEndDate(results.getString("open_to"));
		reservation.setNumberOfAttendees(results.getInt("max_occupancy"));
		reservation.setAccessible(results.getBoolean("is_accessible"));
		return reservation;
	}
	
	private LocalDate convertStartDate(String startDate) {
		LocalDate localStartDate = LocalDate.parse(startDate);
		return localStartDate;
	}



}
