package com.techelevator;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

import javax.sql.DataSource;

import org.junit.After;
import org.junit.AfterClass;
import org.junit.Assert;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import com.techelevator.model.dao.jdbc.JDBCSpaceDAO;
import com.techelevator.model.dao.jdbc.JDBCVenueDAO;
import com.techelevator.model.domain.Space;
import com.techelevator.model.domain.Venue;

public class JDBCSpaceDAOIntegrationTest {

	private static SingleConnectionDataSource dataSource;
	private JDBCSpaceDAO dao;
	private JdbcTemplate jdbcTemplate;
	private static final String TEST_SPACE = "basement";
	private static final String TEST_VENUE = "Ross Hall";
	private Space space;

	@BeforeClass
	public static void setupDataSource() {
		dataSource = new SingleConnectionDataSource();
		dataSource.setUrl("jdbc:postgresql://localhost:5432/excelsior-venues");
		dataSource.setUsername("postgres");
		dataSource.setPassword("postgres1");
		dataSource.setAutoCommit(false);
	}

	@AfterClass
	public static void closeDataSource() throws SQLException {
		dataSource.destroy();
	}

	@Before
	public void preTest() {
		String sqlInsertSpace = "INSERT INTO space (id, venue_id, name, is_accessible, open_from, open_to, daily_rate, max_occupancy) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
		JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
		jdbcTemplate.update(sqlInsertSpace, 100, 5, TEST_SPACE, true, null, null, 2400, 100);
		dao = new JDBCSpaceDAO(dataSource);
	}

	@After
	public void rollback() throws SQLException {
		dataSource.getConnection().rollback();
	}

	protected DataSource getDataSource() {
		return dataSource;
	}

	@Test
	public void testGetSpacesFromVenue() {
		List<Space> spacesList = new ArrayList<>();
		boolean spaceExists = false;

		spacesList = dao.getSpacesFromVenue("Smirking Stone Bistro");

		for (Space space : spacesList) {
			if (space.getName().equals(TEST_SPACE)) {
				spaceExists = true;
			}
		}
		Assert.assertTrue(spaceExists);

	}

}
